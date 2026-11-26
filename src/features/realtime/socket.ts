import type { WsClientEvent, WsServerEvent } from "@/lib/api/types";

/*
 * One authenticated WebSocket per tab to GET /v1/ws.
 *
 * Protocol (crates/chat/src/ws.rs): the first frame is {"type":"auth","token"} and must arrive
 * within 10 s; the server answers {"type":"ready"}. It sends "reauth" two minutes before the token
 * expires and closes with 4401 when the token is missing, invalid or expired. It drops sockets that
 * are silent for 75 s.
 *
 * Behind a proxy (Railway) idle sockets are cut after about 30 s and a cut can leave the browser
 * believing the socket is open (half-open). So:
 *  - we ping every 20 s and expect any frame back within 8 s, otherwise the socket is dead and is replaced;
 *  - reconnect backoff is capped at 5 s while the tab is visible (30 s while hidden);
 *  - on visibility, focus and `online` we verify the socket with a ping and run the catch-up listeners
 *    (refetch what may have been missed), throttled so a burst of events refetches once;
 *  - a 4401 refreshes the token and reconnects at once;
 *  - a generation counter makes start/stop/start (React strict mode, route changes) leave one socket.
 */

export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "offline" | "paused";

/** `refresh`: the server rejected the last token. `fresh`: the server asked for a new one (it expires within two minutes). */
type TokenSource = (opts?: { refresh?: boolean; fresh?: boolean }) => Promise<string | null>;

export const PING_EVERY = 20_000;
export const PONG_TIMEOUT = 8_000;
export const AUTH_TIMEOUT = 12_000;
export const HIDDEN_GRACE = 5 * 60_000;
export const BACKOFF_BASE = 500;
export const BACKOFF_MAX_VISIBLE = 5_000;
export const BACKOFF_MAX_HIDDEN = 30_000;
export const CATCH_UP_THROTTLE = 4_000;

/** Reconnect delay for attempt n (0-based), with jitter in [ceiling/2, ceiling]. `random` is injectable for tests. */
export function backoffDelay(attempt: number, visible: boolean, random: () => number = Math.random): number {
  const max = visible ? BACKOFF_MAX_VISIBLE : BACKOFF_MAX_HIDDEN;
  const ceiling = Math.min(max, BACKOFF_BASE * 2 ** attempt);
  return ceiling / 2 + random() * (ceiling / 2);
}

export class RealtimeClient {
  private readonly url: string;
  private readonly getToken: TokenSource;
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = "idle";
  private running = false;
  /** Bumped by start() and stop(): an async connect from an older generation drops out. */
  private gen = 0;
  private attempt = 0;
  private authFailures = 0;
  private everReady = false;
  private lastCatchUp = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private pongTimer: ReturnType<typeof setTimeout> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(ev: WsServerEvent) => void>();
  private readonly statusListeners = new Set<() => void>();
  private readonly catchUpListeners = new Set<() => void>();
  /** The signed-in user, from the server's "ready" frame. */
  userId: string | null = null;

  constructor(url: string, getToken: TokenSource) {
    this.url = url;
    this.getToken = getToken;
  }

  /* ---------- public API ---------- */

  start() {
    if (this.running) return;
    this.running = true;
    this.gen += 1;
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    window.addEventListener("focus", this.onFocus);
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.connect();
  }

  stop() {
    this.running = false;
    this.gen += 1;
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    window.removeEventListener("focus", this.onFocus);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.clearTimers();
    this.closeSocket(1000, "client stopped");
    this.everReady = false;
    this.userId = null;
    this.setStatus("idle");
  }

  /** Subscribe to every server event. Returns an unsubscribe function. */
  subscribe(fn: (ev: WsServerEvent) => void) {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /**
   * Fires when data may have been missed: after a socket reopens (not the first connect), and when the
   * tab returns to view, regains focus or the browser comes back online. Throttled.
   */
  onCatchUp(fn: () => void) {
    this.catchUpListeners.add(fn);
    return () => void this.catchUpListeners.delete(fn);
  }

  onStatus = (fn: () => void) => {
    this.statusListeners.add(fn);
    return () => void this.statusListeners.delete(fn);
  };

  getStatus = () => this.status;

  /** Send a client frame. Returns false when the socket isn't ready. */
  send(ev: WsClientEvent): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.status !== "open") return false;
    try {
      this.ws.send(JSON.stringify(ev));
      return true;
    } catch {
      return false;
    }
  }

  /** Send a fresh auth frame on the open socket (token refreshed, or the server asked). */
  async reauth(token?: string) {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const t = token ?? (await this.getToken({ fresh: true }));
    if (!t || this.ws !== ws) return;
    try {
      ws.send(JSON.stringify({ type: "auth", token: t } satisfies WsClientEvent));
    } catch {
      // The close handler reconnects.
    }
  }

  /* ---------- connection ---------- */

  private async connect() {
    if (!this.running) return;
    const gen = this.gen;
    this.clearReconnect();
    if (this.ws) return; // one socket at a time
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }
    this.setStatus(this.everReady ? "reconnecting" : "connecting");

    const token = await this.getToken({ refresh: this.authFailures > 0 });
    if (!this.running || gen !== this.gen || this.ws) return;
    if (!token) {
      // Signed out: wait for start() after the next sign-in.
      this.setStatus("idle");
      return;
    }

    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify({ type: "auth", token } satisfies WsClientEvent));
      this.authTimer = setTimeout(() => {
        if (this.ws === ws && this.status !== "open") this.dropAndReconnect(4000, "auth timeout");
      }, AUTH_TIMEOUT);
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      // Any frame proves the connection is alive.
      this.clearPong();
      let ev: WsServerEvent;
      try {
        ev = JSON.parse(String(e.data)) as WsServerEvent;
      } catch {
        return;
      }
      if (ev.type === "ready") return this.onReady(ev.user_id);
      if (ev.type === "pong") return;
      if (ev.type === "reauth") {
        void this.reauth();
        return;
      }
      this.listeners.forEach((l) => {
        try {
          l(ev);
        } catch (err) {
          console.error("realtime listener failed", err);
        }
      });
    };

    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.stopPing();
      if (this.authTimer) clearTimeout(this.authTimer);
      if (!this.running || this.status === "paused" || this.status === "offline") return;
      if (e.code === 4401) {
        // Token invalid or expired: refresh the session and retry straight away (once), then back off.
        this.authFailures += 1;
        if (this.authFailures === 1) {
          this.setStatus(this.everReady ? "reconnecting" : "connecting");
          void this.connect();
          return;
        }
      }
      this.scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose follows and handles the retry.
    };
  }

  private onReady(userId: string) {
    if (this.authTimer) clearTimeout(this.authTimer);
    const reconnected = this.everReady;
    this.everReady = true;
    this.attempt = 0;
    this.authFailures = 0;
    this.userId = userId;
    this.setStatus("open");
    this.startPing();
    if (reconnected) this.catchUp(true);
  }

  private scheduleReconnect() {
    if (!this.running) return;
    this.setStatus(this.everReady ? "reconnecting" : "connecting");
    // Repeated 4401s mean the session is gone; back off to the hidden ceiling instead of hammering auth.
    const visible = typeof document === "undefined" || document.visibilityState !== "hidden";
    const delay = backoffDelay(this.attempt, visible && this.authFailures <= 3);
    this.attempt += 1;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  /** The socket is dead or suspect: replace it. */
  private dropAndReconnect(code: number, reason: string) {
    this.closeSocket(code, reason);
    this.scheduleReconnect();
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => this.ping(), PING_EVERY);
  }

  /** Send a ping and require some frame back within PONG_TIMEOUT. */
  private ping() {
    if (!this.ws || this.status !== "open") return;
    if (!this.pongTimer) {
      this.pongTimer = setTimeout(() => {
        this.pongTimer = null;
        // Half-open connection: nothing came back.
        this.dropAndReconnect(4000, "pong timeout");
      }, PONG_TIMEOUT);
    }
    if (!this.send({ type: "ping" })) this.clearPong();
  }

  private clearPong() {
    if (this.pongTimer) clearTimeout(this.pongTimer);
    this.pongTimer = null;
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    this.clearPong();
  }

  private closeSocket(code: number, reason: string) {
    const ws = this.ws;
    this.ws = null;
    this.stopPing();
    if (this.authTimer) clearTimeout(this.authTimer);
    this.authTimer = null;
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try {
        ws.close(code, reason);
      } catch {
        // Already closed.
      }
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearTimers() {
    this.clearReconnect();
    this.stopPing();
    if (this.authTimer) clearTimeout(this.authTimer);
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.authTimer = this.hiddenTimer = null;
  }

  private setStatus(next: RealtimeStatus) {
    if (this.status === next) return;
    this.status = next;
    this.statusListeners.forEach((l) => l());
  }

  /** Run the catch-up listeners, at most once per CATCH_UP_THROTTLE unless `force`. */
  private catchUp(force = false) {
    const now = Date.now();
    if (!force && now - this.lastCatchUp < CATCH_UP_THROTTLE) return;
    this.lastCatchUp = now;
    this.catchUpListeners.forEach((l) => {
      try {
        l();
      } catch (err) {
        console.error("catch-up failed", err);
      }
    });
  }

  /** The tab or network came back: replace a missing socket now, or test the one we have, and refetch. */
  private resume() {
    if (!this.running) return;
    this.attempt = 0;
    if (!this.ws) {
      this.clearReconnect();
      void this.connect();
      return; // onReady fires the catch-up once the socket is up
    }
    if (this.status === "open") {
      this.ping();
      this.catchUp();
    }
  }

  /* ---------- browser lifecycle ---------- */

  private onOnline = () => this.resume();

  private onFocus = () => {
    if (document.visibilityState === "visible") this.resume();
  };

  private onOffline = () => {
    if (!this.running) return;
    this.clearReconnect();
    this.closeSocket(1000, "offline");
    this.setStatus("offline");
  };

  private onVisibility = () => {
    if (!this.running) return;
    if (document.visibilityState === "hidden") {
      if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
      this.hiddenTimer = setTimeout(() => {
        this.clearReconnect();
        this.closeSocket(1000, "hidden");
        this.setStatus("paused");
      }, HIDDEN_GRACE);
      return;
    }
    if (this.hiddenTimer) clearTimeout(this.hiddenTimer);
    this.hiddenTimer = null;
    if (this.status === "paused") this.setStatus("reconnecting");
    this.resume();
  };
}

/** `${NEXT_PUBLIC_API_URL}/v1/ws` with http(s) swapped for ws(s). */
export function socketUrl(apiUrl: string) {
  return `${apiUrl.replace(/^http/, "ws")}/v1/ws`;
}

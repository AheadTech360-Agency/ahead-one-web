import type { WsClientEvent, WsServerEvent } from "@/lib/api/types";

/*
 * One authenticated WebSocket per tab to GET /v1/ws.
 *
 * Protocol (crates/chat/src/ws.rs): the first frame is {"type":"auth","token"} and must arrive
 * within 10 s; the server answers {"type":"ready"}. It sends "reauth" two minutes before the token
 * expires and closes with 4401 when the token is missing, invalid or expired. It drops sockets that
 * are silent for 75 s, so we ping every 25 s.
 *
 * Reconnects use jittered exponential backoff. While the browser is offline, or the tab has been
 * hidden for a while, the socket is closed and reopened on return; every reopen after the first
 * fires onReconnect so callers can refetch what they missed.
 */

export type RealtimeStatus = "idle" | "connecting" | "open" | "reconnecting" | "offline" | "paused";

/** `refresh`: the server rejected the last token. `fresh`: the server asked for a new one (it expires within two minutes). */
type TokenSource = (opts?: { refresh?: boolean; fresh?: boolean }) => Promise<string | null>;

const PING_EVERY = 25_000;
const AUTH_TIMEOUT = 12_000;
const SILENCE_LIMIT = 70_000;
const HIDDEN_GRACE = 5 * 60_000;
const BACKOFF_BASE = 1_000;
const BACKOFF_MAX = 30_000;

export class RealtimeClient {
  private readonly url: string;
  private readonly getToken: TokenSource;
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = "idle";
  private running = false;
  private attempt = 0;
  private authFailures = 0;
  private everReady = false;
  private lastFrameAt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private authTimer: ReturnType<typeof setTimeout> | null = null;
  private hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly listeners = new Set<(ev: WsServerEvent) => void>();
  private readonly statusListeners = new Set<() => void>();
  private readonly reconnectListeners = new Set<() => void>();
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
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.connect();
  }

  stop() {
    this.running = false;
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
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

  /** Fires after a socket reopens (not on the first connect). */
  onReconnect(fn: () => void) {
    this.reconnectListeners.add(fn);
    return () => void this.reconnectListeners.delete(fn);
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
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const t = token ?? (await this.getToken({ fresh: true }));
    if (!t) return;
    try {
      this.ws.send(JSON.stringify({ type: "auth", token: t } satisfies WsClientEvent));
    } catch {
      // The close handler reconnects.
    }
  }

  /* ---------- connection ---------- */

  private async connect() {
    if (!this.running) return;
    this.clearReconnect();
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.setStatus("offline");
      return;
    }
    this.setStatus(this.everReady ? "reconnecting" : "connecting");

    const token = await this.getToken({ refresh: this.authFailures > 0 });
    if (!this.running) return;
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
      this.lastFrameAt = Date.now();
      ws.send(JSON.stringify({ type: "auth", token } satisfies WsClientEvent));
      this.authTimer = setTimeout(() => {
        if (this.ws === ws && this.status !== "open") this.closeSocket(4000, "auth timeout");
      }, AUTH_TIMEOUT);
    };

    ws.onmessage = (e) => {
      if (this.ws !== ws) return;
      this.lastFrameAt = Date.now();
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
        // Token invalid or expired: refresh the session before the next attempt.
        this.authFailures += 1;
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
    if (reconnected) {
      this.reconnectListeners.forEach((l) => l());
    }
  }

  private scheduleReconnect() {
    if (!this.running) return;
    this.setStatus(this.everReady ? "reconnecting" : "connecting");
    // Repeated 4401s mean the session is gone; back off hard instead of hammering auth.
    const n = this.authFailures > 3 ? this.attempt + 4 : this.attempt;
    const ceiling = Math.min(BACKOFF_MAX, BACKOFF_BASE * 2 ** n);
    const delay = ceiling / 2 + Math.random() * (ceiling / 2);
    this.attempt += 1;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => void this.connect(), delay);
  }

  private startPing() {
    this.stopPing();
    this.pingTimer = setInterval(() => {
      if (Date.now() - this.lastFrameAt > SILENCE_LIMIT) {
        // Half-open connection: nothing (not even a pong) for too long.
        this.closeSocket(4000, "silent");
        this.scheduleReconnect();
        return;
      }
      this.send({ type: "ping" });
    }, PING_EVERY);
  }

  private stopPing() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private closeSocket(code: number, reason: string) {
    const ws = this.ws;
    this.ws = null;
    this.stopPing();
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

  /* ---------- browser lifecycle ---------- */

  private onOnline = () => {
    if (!this.running) return;
    this.attempt = 0;
    void this.connect();
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
    if (this.status === "paused" || this.status === "reconnecting" || this.status === "connecting") {
      // Back in view: retry now instead of waiting out the backoff.
      this.attempt = 0;
      if (!this.ws) void this.connect();
    }
  };
}

/** `${NEXT_PUBLIC_API_URL}/v1/ws` with http(s) swapped for ws(s). */
export function socketUrl(apiUrl: string) {
  return `${apiUrl.replace(/^http/, "ws")}/v1/ws`;
}

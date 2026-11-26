import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import { backoffDelay, BACKOFF_MAX_VISIBLE, PING_EVERY, PONG_TIMEOUT, RealtimeClient } from "./socket.ts";

class FakeWS {
  static OPEN = 1;
  static instances: FakeWS[] = [];
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  onclose: ((e: { code: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  url: string;
  constructor(url: string) {
    this.url = url;
    FakeWS.instances.push(this);
  }
  send(d: string) {
    this.sent.push(d);
  }
  close() {
    this.closed = true;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  recv(o: object) {
    this.onmessage?.({ data: JSON.stringify(o) });
  }
  ready() {
    this.recv({ type: "ready", user_id: "u1" });
  }
  drop(code = 1006) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

type Handler = () => void;
const g = globalThis as unknown as Record<string, unknown>;
let winL: Record<string, Handler[]>;
let docL: Record<string, Handler[]>;
let doc: { visibilityState: string };
let nav: { onLine: boolean };
const tick = async (ms: number) => {
  mock.timers.tick(ms);
  await Promise.resolve();
  await Promise.resolve();
};
const fire = (l: Record<string, Handler[]>, t: string) => (l[t] ?? []).forEach((h) => h());
let tokens: string[];

function make() {
  const c = new RealtimeClient("ws://x/v1/ws", async (o) => {
    tokens.push(o?.refresh ? "refresh" : "plain");
    return "tok";
  });
  return c;
}
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
  FakeWS.instances = [];
  tokens = [];
  winL = {};
  docL = {};
  doc = { visibilityState: "visible" };
  nav = { onLine: true };
  g.WebSocket = FakeWS;
  Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true, writable: true });
  g.document = { get visibilityState() { return doc.visibilityState; }, addEventListener: (t: string, h: Handler) => (docL[t] ??= []).push(h), removeEventListener: (t: string, h: Handler) => (docL[t] = (docL[t] ?? []).filter((x) => x !== h)) };
  g.window = { addEventListener: (t: string, h: Handler) => (winL[t] ??= []).push(h), removeEventListener: (t: string, h: Handler) => (winL[t] = (winL[t] ?? []).filter((x) => x !== h)) };
});
afterEach(() => mock.timers.reset());

async function up(c: RealtimeClient) {
  c.start();
  await flush();
  const ws = FakeWS.instances.at(-1)!;
  ws.open();
  ws.ready();
  return ws;
}

describe("backoff", () => {
  it("is capped low while visible and higher while hidden", () => {
    assert.ok(backoffDelay(10, true, () => 1) <= BACKOFF_MAX_VISIBLE);
    assert.equal(backoffDelay(10, false, () => 1), 30_000);
    assert.equal(backoffDelay(0, true, () => 0), 250);
  });
});

describe("RealtimeClient", () => {
  it("connects, authenticates and goes open", async () => {
    const c = make();
    const ws = await up(c);
    assert.equal(JSON.parse(ws.sent[0]).type, "auth");
    assert.equal(c.getStatus(), "open");
    c.stop();
  });

  it("pings every 20 s and replaces a half-open socket when no pong arrives", async () => {
    const c = make();
    const ws = await up(c);
    await tick(PING_EVERY);
    assert.ok(ws.sent.some((m) => JSON.parse(m).type === "ping"));
    await tick(PONG_TIMEOUT);
    assert.equal(ws.closed, true);
    assert.equal(c.getStatus(), "reconnecting");
    await tick(BACKOFF_MAX_VISIBLE);
    await flush();
    assert.equal(FakeWS.instances.length, 2);
    c.stop();
  });

  it("a pong clears the timeout", async () => {
    const c = make();
    const ws = await up(c);
    await tick(PING_EVERY);
    ws.recv({ type: "pong" });
    await tick(PONG_TIMEOUT + 1);
    assert.equal(ws.closed, false);
    c.stop();
  });

  it("reconnects after a drop and runs catch-up once", async () => {
    const c = make();
    let n = 0;
    c.onCatchUp(() => n++);
    const ws = await up(c);
    assert.equal(n, 0);
    ws.drop();
    await tick(BACKOFF_MAX_VISIBLE);
    await flush();
    const ws2 = FakeWS.instances[1];
    ws2.open();
    ws2.ready();
    assert.equal(n, 1);
    c.stop();
  });

  it("4401 refreshes the token and reconnects at once", async () => {
    const c = make();
    const ws = await up(c);
    ws.drop(4401);
    await flush();
    assert.equal(FakeWS.instances.length, 2);
    assert.equal(tokens.at(-1), "refresh");
    c.stop();
  });

  it("visible, focus and online refetch (throttled) and ping the live socket", async () => {
    const c = make();
    let n = 0;
    c.onCatchUp(() => n++);
    const ws = await up(c);
    await tick(10_000);
    fire(docL, "visibilitychange");
    assert.equal(n, 1);
    fire(winL, "focus");
    assert.equal(n, 1, "throttled");
    await tick(5_000);
    fire(winL, "online");
    assert.equal(n, 2);
    assert.ok(ws.sent.filter((m) => JSON.parse(m).type === "ping").length >= 1);
    c.stop();
  });

  it("start, stop, start leaves one socket (strict mode)", async () => {
    const c = make();
    c.start();
    c.stop();
    c.start();
    await flush();
    assert.equal(FakeWS.instances.length, 1);
    c.stop();
  });

  it("going offline closes and online reopens", async () => {
    const c = make();
    const ws = await up(c);
    nav.onLine = false;
    fire(winL, "offline");
    assert.equal(ws.closed, true);
    assert.equal(c.getStatus(), "offline");
    nav.onLine = true;
    fire(winL, "online");
    await flush();
    assert.equal(FakeWS.instances.length, 2);
    c.stop();
  });
});

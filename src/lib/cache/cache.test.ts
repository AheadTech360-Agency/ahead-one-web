import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CACHE_SCHEMA,
  cacheBuster,
  decideScope,
  hasPrivilegedShape,
  hasSecretShape,
  isPersistableKey,
  PERSIST_MAX_AGE_MS,
  restorableRecord,
  shouldPersistQuery,
} from "./policy.ts";
import { classifyFailure, createNoticeGate } from "./refresh-errors.ts";

const ok = (queryKey: unknown[], data: unknown = {}, extra: object = {}) => ({
  queryKey,
  state: { status: "success", data },
  ...extra,
});

describe("OAuth consent and grants are never persisted", () => {
  it("refuses request and grant keys", () => {
    for (const key of [
      ["oauth", "request", "abcdefgh"],
      ["oauth", "grants", "mine"],
      ["oauth", "grants", "everyone"],
    ]) {
      assert.equal(isPersistableKey(key), false);
      assert.equal(shouldPersistQuery(ok(key)), false);
    }
  });
});

describe("app release is never persisted", () => {
  it("refuses both app-release keys and an opted-out query", () => {
    const keys = [
      ["ws", "w1", "app-release", "android"],
      ["ws", "w1", "app-release", "android", "download"],
    ];
    for (const key of keys) {
      assert.equal(isPersistableKey(key), false);
      assert.equal(shouldPersistQuery(ok(key, { version_name: "1.0.0" })), false);
      assert.equal(shouldPersistQuery(ok(key, {}, { meta: { persist: true } })), false);
    }
  });
  it("treats a payload with download_url as secret", () => {
    assert.equal(hasSecretShape({ download_url: "https://x.r2.cloudflarestorage.com/a" }), true);
  });
});

describe("persisted key allowlist", () => {
  it("allows the stable, user-facing resources", () => {
    for (const key of [
      ["me"],
      ["roles"],
      ["ws", "w1", "tree", { includeArchived: false }],
      ["ws", "w1", "members"],
      ["ws", "w1", "conversations"],
      ["ws", "w1", "dashboard"],
      ["ws", "w1", "team-dashboard", "all"],
      ["ws", "w1", "team-dashboard", "space-1"],
      ["ws", "w1", "my-tasks", "all"],
      ["ws", "w1", "files", "summary"],
      ["project", "p1"],
      ["project", "p1", "members"],
      ["project", "p1", "lists"],
      ["list", "l1", "statuses"],
      ["tasks", "list", "l1", {}],
      ["task", "t1"],
      ["task-comments", "t1"],
      ["task-activity", "t1"],
      ["chat", "c1", "messages"],
      ["chat", "c1", "detail"],
      ["notifications", "unread-count"],
      ["notifications", "list", { unreadOnly: false }],
    ]) {
      assert.equal(isPersistableKey(key), true, JSON.stringify(key));
    }
  });

  it("keeps secrets, signed URLs and low-value or sensitive lists in memory", () => {
    for (const key of [
      ["chat", "attachment-url", "a1"],
      ["invite-preview", "tok"],
      ["ws", "w1", "invites"],
      ["ws", "w1", "member-clients", "u1"],
      ["ws", "w1", "audit-log", {}],
      ["ws", "w1", "search", "term"],
      ["ws", "w1", "files", "list", {}],
      ["ws", "w1", "channels-browse"],
      ["notifications", "prefs"],
      ["notifications", "channels"],
      ["something-new"],
      [],
      ["ws"],
      ["ws", 5, "tree"],
    ]) {
      assert.equal(isPersistableKey(key), false, JSON.stringify(key));
    }
  });

  it("persists only successful queries that opt in and carry no token-shaped field", () => {
    assert.equal(shouldPersistQuery(ok(["me"])), true);
    assert.equal(shouldPersistQuery({ queryKey: ["me"], state: { status: "pending" } }), false);
    assert.equal(shouldPersistQuery({ queryKey: ["me"], state: { status: "error" } }), false);
    assert.equal(shouldPersistQuery(ok(["me"], {}, { meta: { persist: false } })), false);
    assert.equal(shouldPersistQuery(ok(["me"], { user: { access_token: "x" } })), false);
    assert.equal(shouldPersistQuery(ok(["task", "t1"], { attachments: [{ download_url: "https://s" }] })), false);
  });
});

describe("secret scan", () => {
  it("finds token-shaped fields at any depth, including inside arrays", () => {
    assert.equal(hasSecretShape({ a: [{ b: { refresh_token: "x" } }] }), true);
    assert.equal(hasSecretShape({ Password: "x" }), true);
    assert.equal(hasSecretShape({ user: { id: "1", full_name: "A", avatar_url: null } }), false);
    assert.equal(hasSecretShape("plain"), false);
    assert.equal(hasSecretShape(null), false);
  });
  it("treats a payload past the node budget as unsafe", () => {
    assert.equal(hasSecretShape({ a: { b: { c: 1 } } }, 2), true);
  });
});

describe("buster and restore validation", () => {
  const rec = (over: object = {}) => ({ userId: "u1", buster: cacheBuster("abc"), timestamp: 1_000, client: {}, ...over });

  it("ties the buster to the schema and the build", () => {
    assert.equal(cacheBuster("abc"), `${CACHE_SCHEMA}:abc`);
    assert.equal(cacheBuster(undefined), `${CACHE_SCHEMA}:local`);
    assert.notEqual(cacheBuster("abc"), cacheBuster("abd"));
  });

  it("restores a fresh record from the same build", () => {
    assert.ok(restorableRecord(rec(), { buster: cacheBuster("abc"), now: 2_000 }));
  });
  it("drops a record from another build or schema", () => {
    assert.equal(restorableRecord(rec(), { buster: cacheBuster("def"), now: 2_000 }), null);
  });
  it("drops an expired record and one dated in the future", () => {
    assert.equal(restorableRecord(rec(), { buster: cacheBuster("abc"), now: 1_000 + PERSIST_MAX_AGE_MS + 1 }), null);
    assert.equal(restorableRecord(rec({ timestamp: 9_000 }), { buster: cacheBuster("abc"), now: 2_000 }), null);
  });
  it("drops malformed records and ones nobody owns", () => {
    const o = { buster: cacheBuster("abc"), now: 2_000 };
    for (const bad of [undefined, null, "x", {}, rec({ userId: null }), rec({ userId: "" }), rec({ client: null }), rec({ timestamp: "1" })]) {
      assert.equal(restorableRecord(bad, o), null);
    }
  });
});

describe("user scoping", () => {
  it("adopts when nothing was restored", () => {
    assert.equal(decideScope(null, "u1"), "adopt");
    assert.equal(decideScope(undefined, "u1"), "adopt");
  });
  it("keeps the cache for the same user", () => {
    assert.equal(decideScope("u1", "u1"), "keep");
  });
  it("wipes the cache when the user id changed", () => {
    assert.equal(decideScope("u1", "u2"), "wipe");
  });
});

describe("refresh failure notices", () => {
  it("only announces failures that happen over cached data", () => {
    assert.equal(classifyFailure({ hasData: false, online: true }), null);
    assert.equal(classifyFailure({ hasData: true, online: true, status: 500 }), "failed");
    assert.equal(classifyFailure({ hasData: true, online: true, status: 0 }), "failed");
  });
  it("gives offline its own kind", () => {
    assert.equal(classifyFailure({ hasData: true, online: false, status: 0 }), "offline");
  });
  it("leaves auth and access changes to their own handling", () => {
    assert.equal(classifyFailure({ hasData: true, online: true, status: 401 }), null);
    assert.equal(classifyFailure({ hasData: true, online: true, status: 403 }), null);
    assert.equal(classifyFailure({ hasData: true, online: true, status: 404 }), null);
    assert.equal(classifyFailure({ hasData: true, online: true, code: "mfa_required" }), null);
  });

  it("de-duplicates a burst into one notice per kind per window", () => {
    let t = 0;
    const gate = createNoticeGate(8_000, () => t);
    const shown = Array.from({ length: 10 }, () => gate.allow("failed")).filter(Boolean);
    assert.equal(shown.length, 1);
    assert.equal(gate.allow("offline"), true, "other kinds are independent");
    t = 7_999;
    assert.equal(gate.allow("failed"), false);
    t = 8_000;
    assert.equal(gate.allow("failed"), true, "allowed again after the window");
  });
  it("re-arms after reset (dismissed or retried)", () => {
    const gate = createNoticeGate(8_000, () => 0);
    assert.equal(gate.allow("failed"), true);
    assert.equal(gate.allow("failed"), false);
    gate.reset("failed");
    assert.equal(gate.allow("failed"), true);
    gate.reset();
    assert.equal(gate.allow("failed"), true);
  });
});

describe("Owner and Admin only fields stay off disk", () => {
  const ok = (key: readonly unknown[], data: unknown) => shouldPersistQuery({ queryKey: key as never, state: { status: "success", data }, meta: undefined });
  it("detects the privileged field names", () => {
    assert.equal(hasPrivilegedShape({ members: [{ user: {}, two_factor_enabled: true }] }), true);
    assert.equal(hasPrivilegedShape({ owner: { recent_audit: [] } }), true);
    assert.equal(hasPrivilegedShape([{ role: "admin", all_clients: false, space_ids: ["a"] }]), true);
    assert.equal(hasPrivilegedShape({ totals: { open_tasks: 3 }, workload: [] }), false);
  });
  it("does not persist the Owner dashboard or the Owner and Admin member list", () => {
    assert.equal(ok(["ws", "w1", "team-dashboard", "all"], { totals: {}, owner: { role_counts: [], recent_audit: [] } }), false);
    assert.equal(ok(["ws", "w1", "members"], [{ user: { id: "u" }, role: "member", two_factor_enabled: false }]), false);
  });
  it("still persists an Admin dashboard and a plain member list", () => {
    assert.equal(ok(["ws", "w1", "team-dashboard", "all"], { totals: { open_tasks: 4 }, owner: null, workload: [] }), true);
    assert.equal(ok(["ws", "w1", "members"], [{ user: { id: "u" }, role: "member" }]), true);
  });
});

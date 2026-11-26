import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignableRoles,
  canEditRole,
  CAPABILITIES,
  clientAccessChangeCopy,
  clientAccessLabel,
  grantFor,
  isAccessAction,
  roleChangeCopy,
  roleErrorMessage,
  ROLE_ORDER,
} from "./rules.ts";

describe("permissions matrix", () => {
  it("has every role in every row", () => {
    for (const c of CAPABILITIES) for (const r of ROLE_ORDER) assert.ok(c.grants[r], `${c.id}/${r}`);
  });
  it("matches the API rules", () => {
    assert.equal(grantFor("owner", "manage_roles"), "yes");
    assert.equal(grantFor("admin", "manage_roles"), "scoped");
    assert.equal(grantFor("management", "invite_people"), "no");
    assert.equal(grantFor("management", "see_all_clients"), "yes");
    assert.equal(grantFor("admin", "see_all_clients"), "scoped");
    assert.equal(grantFor("guest", "edit_tasks"), "no");
    assert.equal(grantFor("guest", "comment_attach"), "yes");
    assert.equal(grantFor("guest", "android_app"), "no");
    assert.equal(grantFor("member", "see_dashboards"), "no");
    assert.equal(grantFor("management", "audit_log"), "no");
    assert.equal(grantFor("admin", "audit_log"), "yes");
  });
  it("never lets a lower role out-rank a higher one", () => {
    const n = { yes: 2, scoped: 1, no: 0 } as const;
    for (const c of CAPABILITIES) {
      if (c.id === "see_all_clients") continue; // Management sees all; an Admin can be scoped by the Owner.
      for (let i = 1; i < ROLE_ORDER.length; i++) {
        assert.ok(n[c.grants[ROLE_ORDER[i - 1]!]] >= n[c.grants[ROLE_ORDER[i]!]], `${c.id}: ${ROLE_ORDER[i]}`);
      }
    }
  });
});

describe("who may change roles", () => {
  it("only the owner grants admin and nobody grants owner", () => {
    assert.deepEqual(assignableRoles("owner"), ["admin", "management", "member", "guest"]);
    assert.deepEqual(assignableRoles("admin"), ["management", "member", "guest"]);
    assert.deepEqual(assignableRoles("member"), []);
    assert.deepEqual(assignableRoles(undefined), []);
  });
  it("protects owners, admins and yourself", () => {
    assert.equal(canEditRole("owner", "owner", false), false);
    assert.equal(canEditRole("owner", "admin", false), true);
    assert.equal(canEditRole("owner", "member", true), false);
    assert.equal(canEditRole("admin", "admin", false), false);
    assert.equal(canEditRole("admin", "member", false), true);
    assert.equal(canEditRole("management", "member", false), false);
  });
});

describe("role change confirmation copy", () => {
  it("states what a promotion gains", () => {
    const c = roleChangeCopy("Sana", "management", "admin");
    assert.equal(c.title, "Make Sana an Admin?");
    assert.equal(c.isDowngrade, false);
    assert.ok(c.gains.includes("invite people"));
    assert.ok(c.gains.includes("see the audit log"));
    assert.deepEqual(c.loses, []);
  });
  it("states what a demotion loses", () => {
    const c = roleChangeCopy("Omar", "admin", "member");
    assert.equal(c.title, "Make Omar a Member?");
    assert.equal(c.isDowngrade, true);
    assert.ok(c.loses.includes("manage clients and projects"));
    assert.ok(c.loses.includes("see the audit log"));
  });
  it("tells guests they keep comments", () => {
    const c = roleChangeCopy("Lee", "member", "guest");
    assert.ok(c.loses.some((l) => l.includes("still comment")));
  });
  it("never uses an em dash", () => {
    for (const a of ROLE_ORDER)
      for (const b of ROLE_ORDER) {
        const c = roleChangeCopy("X", a, b);
        assert.ok(![c.title, c.headline, ...c.gains, ...c.loses].some((s) => s.includes("—")));
      }
  });
});

describe("API errors", () => {
  it("maps the last owner guard", () => {
    assert.match(roleErrorMessage(409, "a workspace needs at least one owner"), /at least one Owner/);
    assert.match(roleErrorMessage(409, "you can't change your own role or remove yourself; ask another owner"), /your own role/);
    assert.match(roleErrorMessage(403, undefined), /Only an Owner/);
  });
});

describe("client access", () => {
  const names: Record<string, string> = { a: "Acme", b: "Birch", c: "Cedar" };
  const nm = (id: string) => names[id]!;
  it("labels", () => {
    assert.equal(clientAccessLabel({ all_clients: true, space_ids: [] }), "All clients");
    assert.equal(clientAccessLabel({ all_clients: false, space_ids: ["a", "b", "c"] }), "3 clients");
    assert.equal(clientAccessLabel({ all_clients: false, space_ids: ["a"] }), "1 client");
    assert.equal(clientAccessLabel({ all_clients: false, space_ids: [] }), "No clients");
  });
  it("names what is lost going from all to some", () => {
    const c = clientAccessChangeCopy("Sana", { all_clients: true, space_ids: [] }, { all_clients: false, space_ids: ["a"] }, nm, ["a", "b", "c"]);
    assert.deepEqual(c.loses, ["Birch", "Cedar"]);
    assert.equal(c.noChange, false);
  });
  it("detects no change and gains", () => {
    const same = clientAccessChangeCopy("S", { all_clients: false, space_ids: ["a", "b"] }, { all_clients: false, space_ids: ["b", "a"] }, nm, ["a", "b", "c"]);
    assert.equal(same.noChange, true);
    const up = clientAccessChangeCopy("S", { all_clients: false, space_ids: ["a"] }, { all_clients: true, space_ids: [] }, nm, ["a", "b", "c"]);
    assert.deepEqual(up.loses, []);
    assert.match(up.lines.join(" "), /every client/);
  });
  it("recognises access audit actions", () => {
    assert.equal(isAccessAction("member.role_changed"), true);
    assert.equal(isAccessAction("member.client_access_changed"), true);
    assert.equal(isAccessAction("project.created"), false);
  });
});

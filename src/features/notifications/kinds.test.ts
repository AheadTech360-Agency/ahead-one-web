import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { deepLink, groupPrefs, kindInfo, KIND_INFO } from "./kinds.ts";

const generated = readFileSync(new URL("../../lib/api/generated/NotificationKind.ts", import.meta.url), "utf8");
const kinds = [...generated.matchAll(/"([a-z_]+)"/g)].map((m) => m[1]);

describe("notification kinds", () => {
  it("found the generated kinds", () => assert.ok(kinds.length >= 7));
  it("every generated NotificationKind has a table entry", () => {
    for (const k of kinds) assert.ok(k in KIND_INFO, `kind "${k}" has no entry in KIND_INFO (src/features/notifications/kinds.ts) or icon in kind-icons.tsx`);
  });
  it("every entry is complete and dash free", () => {
    for (const [k, v] of Object.entries(KIND_INFO)) {
      assert.ok(v.label && v.title && v.group, k);
      assert.ok(!/[—–]/.test(`${v.label}${v.title}${v.description}`), `${k} copy has a dash`);
      assert.ok(v.fallback({}).startsWith("/"), k);
    }
  });
  it("unknown kinds degrade to a generic row", () => {
    assert.equal(kindInfo("brand_new").label, "Update");
    assert.equal(deepLink("brand_new", undefined), "/inbox");
  });
  it("deep links prefer a safe link, then conversation, then the kind", () => {
    assert.equal(deepLink("direct_message", "/messages/abc"), "/messages/abc");
    assert.equal(deepLink("channel_message", "https://evil.test/x", "c1"), "/messages/c1");
    assert.equal(deepLink("channel_message", "//evil.test", null), "/messages");
    assert.equal(deepLink("task_overdue", ""), "/my-tasks");
  });
  it("groups prefs in order and lets the API title win", () => {
    const g = groupPrefs([
      { kind: "app_update" },
      { kind: "task_overdue" },
      { kind: "direct_message", title: "DMs from API", description: "d" },
      { kind: "mentioned" },
    ]);
    assert.deepEqual(g.map((x) => x.group), ["Messages", "Mentions", "Tasks", "System"]);
    assert.equal(g[0].rows[0].title, "DMs from API");
    assert.equal(g[2].rows[0].title, "Overdue");
  });
});

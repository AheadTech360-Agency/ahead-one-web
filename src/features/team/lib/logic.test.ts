import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  activityVerb,
  ago,
  canSeeTeamDashboard,
  chartPoints,
  dashboardKind,
  formatBytes,
  formatCount,
  groupTimeline,
  parseClientParam,
  parseProjectParam,
  projectsForPicker,
  resolveProject,
  scopeLevel,
  percent,
  resolveClient,
  timelineBucket,
  viewHref,
  viewMode,
  weekDelta,
} from "./logic.ts";

const ID_A = "11111111-1111-4111-8111-111111111111";
const ID_B = "22222222-2222-4222-8222-222222222222";

describe("role routing", () => {
  it("gives each role its own dashboard", () => {
    assert.equal(dashboardKind("owner"), "executive");
    assert.equal(dashboardKind("admin"), "operations");
    assert.equal(dashboardKind("management"), "operations");
    assert.equal(dashboardKind("member"), "personal");
    assert.equal(dashboardKind("guest"), "personal");
    assert.equal(dashboardKind(undefined), "personal");
  });
  it("only asks the API for the team dashboard when it will answer", () => {
    assert.equal(canSeeTeamDashboard("owner"), true);
    assert.equal(canSeeTeamDashboard("management"), true);
    assert.equal(canSeeTeamDashboard("member"), false);
    assert.equal(canSeeTeamDashboard("guest"), false);
    assert.equal(canSeeTeamDashboard(undefined), false);
  });
});

describe("client scope", () => {
  it("accepts only uuids from the URL", () => {
    assert.equal(parseClientParam(ID_A), ID_A);
    assert.equal(parseClientParam(ID_A.toUpperCase()), ID_A);
    assert.equal(parseClientParam("../etc"), undefined);
    assert.equal(parseClientParam(""), undefined);
    assert.equal(parseClientParam(null), undefined);
  });
  it("never keeps a client the API did not list", () => {
    const clients = [{ space_id: ID_A }];
    assert.equal(resolveClient(ID_A, clients), ID_A);
    assert.equal(resolveClient(ID_B, clients), undefined);
    assert.equal(resolveClient(ID_B, undefined), ID_B); // list unknown yet: request may start
    assert.equal(resolveClient(undefined, clients), undefined);
  });
  it("names the view and builds links", () => {
    assert.equal(viewMode(ID_A), "client");
    assert.equal(viewMode(undefined), "complete");
    assert.equal(viewHref("/", "", ID_A), `/?client=${ID_A}`);
    assert.equal(viewHref("/", `client=${ID_A}&x=1`, undefined), "/?x=1");
    assert.equal(viewHref("/", `client=${ID_A}`, undefined), "/");
  });
});

describe("timeline grouping", () => {
  const now = new Date(2026, 10, 26, 10, 0, 0); // Thu 26 Nov 2026, local
  const at = (dayOffset: number, h = 12) => new Date(2026, 10, 26 + dayOffset, h).toISOString();
  it("buckets by calendar day", () => {
    assert.equal(timelineBucket(at(-1, 23), now), "overdue");
    assert.equal(timelineBucket(at(0, 1), now), "today");
    assert.equal(timelineBucket(at(0, 23), now), "today");
    assert.equal(timelineBucket(at(1), now), "tomorrow");
    assert.equal(timelineBucket(at(2), now), "this_week");
    assert.equal(timelineBucket(at(7), now), "this_week");
    assert.equal(timelineBucket(at(8), now), null);
    assert.equal(timelineBucket("nope", now), null);
  });
  it("groups, sorts and caps", () => {
    const tasks = [
      { id: "a", due_at: at(3) },
      { id: "b", due_at: at(-2) },
      { id: "c", due_at: at(-5) },
      { id: "d", due_at: at(0) },
      { id: "e", due_at: at(30) },
    ];
    const g = groupTimeline(tasks, now, 1);
    assert.equal(g.overdue.total, 2);
    assert.deepEqual(g.overdue.items.map((t) => t.id), ["c"]);
    assert.equal(g.today.total, 1);
    assert.equal(g.tomorrow.total, 0);
    assert.equal(g.this_week.total, 1);
  });
});

describe("number formatting", () => {
  it("counts", () => {
    assert.equal(formatCount(0), "0");
    assert.equal(formatCount(999), "999");
    assert.equal(formatCount(1234), "1,234");
    assert.equal(formatCount(12_400), "12.4k");
    assert.equal(formatCount(120_000), "120k");
    assert.equal(formatCount(1_250_000), "1.3M");
    assert.equal(formatCount(Number.NaN), "0");
  });
  it("bytes", () => {
    assert.equal(formatBytes(0), "0 B");
    assert.equal(formatBytes(512), "512 B");
    assert.equal(formatBytes(1500), "1.5 KB");
    assert.equal(formatBytes(2_000_000), "2 MB");
    assert.equal(formatBytes(48_300_000_000), "48.3 GB");
  });
  it("week delta", () => {
    assert.deepEqual(weekDelta(12, 8), { direction: "up", text: "+4 vs last week", abs: 4 });
    assert.deepEqual(weekDelta(3, 5), { direction: "down", text: "-2 vs last week", abs: 2 });
    assert.equal(weekDelta(4, 4).direction, "flat");
  });
  it("percent and chart points", () => {
    assert.equal(percent(1, 3), 33);
    assert.equal(percent(5, 0), 0);
    assert.equal(percent(9, 3), 100);
    const pts = chartPoints([0, 5, 10], 100, 40);
    assert.equal(pts[0]!.y, 38);
    assert.equal(pts[2]!.y, 2);
    assert.equal(pts[2]!.x, 100);
    assert.equal(chartPoints([0, 0], 10, 10)[0]!.y, 8);
  });
});

describe("activity wording", () => {
  it("never shows a raw kind", () => {
    assert.equal(activityVerb("completed"), "completed");
    assert.equal(activityVerb("brand_new_kind"), "updated");
  });
  it("writes short relative times", () => {
    const now = new Date("2026-11-26T12:00:00Z");
    assert.equal(ago("2026-11-26T11:59:40Z", now), "now");
    assert.equal(ago("2026-11-26T11:30:00Z", now), "30m");
    assert.equal(ago("2026-11-26T09:00:00Z", now), "3h");
    assert.equal(ago("2026-11-24T12:00:00Z", now), "2d");
  });
});

describe("project scope", () => {
  const C = "11111111-1111-4111-8111-111111111111";
  const P = "22222222-2222-4222-8222-222222222222";
  it("parses and levels", () => {
    assert.equal(parseProjectParam(P.toUpperCase()), P);
    assert.equal(parseProjectParam("nope"), undefined);
    assert.equal(scopeLevel(undefined, P), "complete");
    assert.equal(scopeLevel(C, undefined), "client");
    assert.equal(scopeLevel(C, P), "project");
  });
  it("resolves only listed projects", () => {
    assert.equal(resolveProject(undefined, P, [{ project_id: P }]), undefined);
    assert.equal(resolveProject(C, P, undefined), P);
    assert.equal(resolveProject(C, P, [{ project_id: P }]), P);
    assert.equal(resolveProject(C, P, [{ project_id: "x" }]), undefined);
  });
  it("sorts picker rows and prefers projects_in_scope", () => {
    const base = { project_id: "a", name: "A", color: "#000", open: 1, overdue: 0, done_7d: 0 };
    const rows = projectsForPicker({ projects: [base, { ...base, project_id: "b", name: "B", overdue: 2 }] });
    assert.deepEqual(rows.map((r) => r.project_id), ["b", "a"]);
    const scoped = projectsForPicker({ projects: [base], projects_in_scope: [{ ...base, project_id: "z", members: 3 }] });
    assert.deepEqual(scoped.map((r) => r.project_id), ["z"]);
  });
  it("viewHref keeps project only under a client", () => {
    assert.equal(viewHref("/", "", C, P), `/?client=${C}&project=${P}`);
    assert.equal(viewHref("/", `client=${C}&project=${P}`, undefined), "/");
    assert.equal(viewHref("/", `client=${C}&project=${P}`, C), `/?client=${C}`);
  });
});

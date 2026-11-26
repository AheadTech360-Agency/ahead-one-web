/*
 * DEV ONLY. Typed fixtures for the team dashboards, used by dev-fixtures/shoot.mjs (Playwright with
 * page.route) to render each role without an API. Lives outside src/, is imported by nothing in the
 * app, and is therefore never in a production bundle.
 */
import type { MeResponse, Member, Role, UserSummary } from "../src/lib/api/types";
import type { ClientSummary, TeamDashboard, TimelineTask } from "../src/lib/api/types";

export const WS = "00000000-0000-4000-8000-0000000000aa";

const u = (n: number, full_name: string): UserSummary => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  full_name,
  email: `${full_name.split(" ")[0]!.toLowerCase()}@aheadtech360.test`,
  avatar_url: null,
});

export const PEOPLE = {
  owner: u(1, "Hira Malik"),
  admin: u(2, "Omar Siddiqui"),
  mgmt: u(3, "Sana Raza"),
  a: u(4, "Bilal Ahmed"),
  b: u(5, "Maryam Qureshi"),
  c: u(6, "Daniyal Khan"),
  d: u(7, "Ayesha Noor"),
  e: u(8, "Talha Yousaf"),
  f: u(9, "Zainab Farooq"),
};

const sp = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const CLIENT_IDS = { acme: sp(1), birch: sp(2), cedar: sp(3), delta: sp(4), ember: sp(5), fjord: sp(6) };

export const CLIENTS: ClientSummary[] = [
  { space_id: CLIENT_IDS.acme, name: "Acme Logistics", color: "#2e5597", projects: 4, open: 41, overdue: 6, done_7d: 18, members: 7 },
  { space_id: CLIENT_IDS.birch, name: "Birchwood Dental", color: "#1f9a63", projects: 2, open: 17, overdue: 0, done_7d: 9, members: 4 },
  { space_id: CLIENT_IDS.cedar, name: "Cedar & Finch", color: "#c4650a", projects: 3, open: 28, overdue: 3, done_7d: 12, members: 5 },
  { space_id: CLIENT_IDS.delta, name: "Delta Ridge Capital", color: "#7b4fb8", projects: 2, open: 12, overdue: 1, done_7d: 5, members: 3 },
  { space_id: CLIENT_IDS.ember, name: "Ember Coffee Roasters", color: "#b8324a", projects: 1, open: 6, overdue: 0, done_7d: 4, members: 3 },
  { space_id: CLIENT_IDS.fjord, name: "Fjord Outdoors", color: "#0f8aa3", projects: 3, open: 21, overdue: 2, done_7d: 11, members: 6 },
];

function at(dayOffset: number, hour = 17): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const T = (n: number, title: string, day: number, client: ClientSummary, project: string, who: UserSummary[], priority: TimelineTask["priority"] = "normal"): TimelineTask => ({
  task_id: `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  title,
  due_date: at(day).slice(0, 10),
  status_name: "In progress",
  priority,
  project_id: `30000000-0000-4000-8000-${String(n % 5).padStart(12, "0")}`,
  project_name: project,
  space_id: client.space_id,
  space_name: client.name,
  assignees: who,
});

const [acme, birch, cedar, delta, ember, fjord] = CLIENTS as [ClientSummary, ClientSummary, ClientSummary, ClientSummary, ClientSummary, ClientSummary];
const P = PEOPLE;

export const TIMELINE_ALL = {
  overdue: { total: 12, tasks: [
    T(1, "Reconcile Q3 carrier invoices", -6, acme, "Billing portal", [P.a], "urgent"),
    T(2, "Fix checkout address validation", -3, cedar, "Storefront rebuild", [P.b, P.c]),
    T(3, "Send revised retainer proposal", -2, delta, "Retainer renewal", []),
    T(4, "Publish trail guide landing page", -1, fjord, "Spring campaign", [P.d]),
  ] },
  today: { total: 7, tasks: [
    T(5, "Review homepage hero copy", 0, birch, "Website refresh", [P.mgmt, P.e]),
    T(6, "Deploy tracking widget to staging", 0, acme, "Customer tracking", [P.c], "high"),
    T(7, "Record onboarding walkthrough", 0, ember, "Wholesale portal", [P.f]),
  ] },
  tomorrow: { total: 5, tasks: [
    T(8, "Approve label artwork", 1, ember, "Packaging", [P.b]),
    T(9, "Weekly client status call prep", 1, delta, "Retainer renewal", [P.admin, P.a, P.b, P.c]),
  ] },
  this_week: { total: 19, tasks: [
    T(10, "Migrate product images to CDN", 3, cedar, "Storefront rebuild", [P.e]),
    T(11, "Draft Q4 content calendar", 4, fjord, "Spring campaign", [P.d, P.f]),
    T(12, "Security review sign-off", 5, acme, "Billing portal", []),
  ] },
};

function scopeTimeline(c: ClientSummary) {
  const f = (tasks: TimelineTask[]) => tasks.filter((t) => t.space_id === c.space_id);
  const t = TIMELINE_ALL;
  const mk = (b: { tasks: TimelineTask[] }) => ({ total: f(b.tasks).length, tasks: f(b.tasks) });
  return { overdue: mk(t.overdue), today: mk(t.today), tomorrow: mk(t.tomorrow), this_week: mk(t.this_week) };
}

const days = (vals: number[]) =>
  vals.map((count, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (vals.length - 1 - i));
    return { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, count };
  });

const WORKLOAD = [
  { user: P.a, open: 18, overdue: 4, done_7d: 9 },
  { user: P.c, open: 15, overdue: 2, done_7d: 7 },
  { user: P.b, open: 12, overdue: 3, done_7d: 11 },
  { user: P.mgmt, open: 9, overdue: 0, done_7d: 6 },
  { user: P.d, open: 8, overdue: 1, done_7d: 5 },
  { user: P.e, open: 6, overdue: 0, done_7d: 4 },
  { user: P.f, open: 3, overdue: 0, done_7d: 2 },
  { user: P.admin, open: 0, overdue: 0, done_7d: 1 },
];

const PROJECTS = [
  { project_id: "30000000-0000-4000-8000-000000000001", name: "Billing portal", color: "#2e5597", open: 14, overdue: 4, done_7d: 6 },
  { project_id: "30000000-0000-4000-8000-000000000002", name: "Storefront rebuild", color: "#c4650a", open: 19, overdue: 3, done_7d: 8 },
  { project_id: "30000000-0000-4000-8000-000000000003", name: "Spring campaign", color: "#0f8aa3", open: 11, overdue: 2, done_7d: 7 },
  { project_id: "30000000-0000-4000-8000-000000000004", name: "Website refresh", color: "#1f9a63", open: 9, overdue: 0, done_7d: 9 },
  { project_id: "30000000-0000-4000-8000-000000000005", name: "Retainer renewal", color: "#7b4fb8", open: 6, overdue: 1, done_7d: 2 },
  { project_id: "30000000-0000-4000-8000-000000000006", name: "Wholesale portal", color: "#b8324a", open: 6, overdue: 0, done_7d: 4 },
];

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const ACTIVITY = [
  { id: "a1", kind: "completed", actor: P.b, task_id: "20000000-0000-4000-8000-000000000008", task_title: "Approve label artwork", project_id: PROJECTS[5]!.project_id, project_name: "Wholesale portal", created_at: ago(6) },
  { id: "a2", kind: "comment_added", actor: P.a, task_id: "20000000-0000-4000-8000-000000000001", task_title: "Reconcile Q3 carrier invoices", project_id: PROJECTS[0]!.project_id, project_name: "Billing portal", created_at: ago(41) },
  { id: "a3", kind: "assignees_changed", actor: P.mgmt, task_id: "20000000-0000-4000-8000-000000000005", task_title: "Review homepage hero copy", project_id: PROJECTS[3]!.project_id, project_name: "Website refresh", created_at: ago(130) },
  { id: "a4", kind: "status_changed", actor: P.c, task_id: "20000000-0000-4000-8000-000000000006", task_title: "Deploy tracking widget to staging", project_id: PROJECTS[0]!.project_id, project_name: "Customer tracking", created_at: ago(260) },
  { id: "a5", kind: "created", actor: P.d, task_id: "20000000-0000-4000-8000-000000000011", task_title: "Draft Q4 content calendar", project_id: PROJECTS[2]!.project_id, project_name: "Spring campaign", created_at: ago(1500) },
  { id: "a6", kind: "attachment_added", actor: P.e, task_id: "20000000-0000-4000-8000-000000000010", task_title: "Migrate product images to CDN", project_id: PROJECTS[1]!.project_id, project_name: "Storefront rebuild", created_at: ago(2900) },
];

export type Who = "owner" | "admin" | "adminScoped" | "management";

/** The team dashboard as the API would answer for `who`, optionally scoped to one client. */
export function teamDashboard(who: Who, spaceId?: string): TeamDashboard {
  let clients = CLIENTS;
  if (who === "adminScoped") clients = [acme, cedar, fjord];
  const scope = spaceId ? clients.find((c) => c.space_id === spaceId) : undefined;
  const sum = (k: "open" | "overdue" | "done_7d") => (scope ? scope[k] : clients.reduce((n, c) => n + c[k], 0));
  const share = scope ? scope.open / Math.max(1, clients.reduce((n, c) => n + c.open, 0)) : 1;
  const sc = (n: number) => Math.max(0, Math.round(n * (scope ? share * 1.6 : 1)));
  const tl = scope ? scopeTimeline(scope) : TIMELINE_ALL;
  return {
    totals: {
      open_tasks: sum("open"),
      overdue_tasks: sum("overdue"),
      completed_7d: sum("done_7d"),
      completed_prev_7d: Math.round(sum("done_7d") * 0.78),
      active_projects: scope ? scope.projects : clients.reduce((n, c) => n + c.projects, 0),
      members: scope ? scope.members : 9,
      pending_invites: 2,
    },
    completed_by_day: days(scope ? [1, 2, 0, 3, 2, 1, 0, 2, 3, 4, 1, 2, 5, 3] : [4, 6, 2, 9, 7, 3, 1, 5, 8, 11, 6, 7, 12, 9]),
    projects: scope ? PROJECTS.slice(0, scope.projects) : PROJECTS,
    workload: scope ? WORKLOAD.slice(0, 5).map((w) => ({ ...w, open: sc(w.open), overdue: Math.min(sc(w.open), Math.round(w.overdue * share * 2)), done_7d: sc(w.done_7d) })) : WORKLOAD,
    unassigned_open: scope ? 2 : 7,
    recent_activity: ACTIVITY,
    files: scope ? { count: 64, total_bytes: 412_000_000, expiring_soon: 0 } : { count: 842, total_bytes: 6_480_000_000, expiring_soon: 14 },
    scope: scope ? { space_id: scope.space_id, space_name: scope.name } : { space_id: null, space_name: null },
    clients,
    timeline: tl,
    owner:
      who === "owner"
        ? {
            role_counts: [
              { role: "owner", count: 1 },
              { role: "admin", count: 2 },
              { role: "management", count: 1 },
              { role: "member", count: 4 },
              { role: "guest", count: 1 },
            ],
            joined_30d: 3,
            members_without_two_factor: 4,
            storage_bytes: 6_480_000_000,
            recent_audit: [
              { id: "e1", action: "member.role_changed", actor: P.owner, target: "user", target_id: P.mgmt.id, created_at: ago(55) },
              { id: "e2", action: "invite.created", actor: P.admin, target: "invite", target_id: null, created_at: ago(300) },
              { id: "e3", action: "member.client_access_changed", actor: P.owner, target: "user", target_id: P.admin.id, created_at: ago(1600) },
              { id: "e4", action: "space.created", actor: P.mgmt, target: "space", target_id: null, created_at: ago(4000) },
            ],
          }
        : null,
  };
}

export function me(role: Role): MeResponse {
  const user = { ...(role === "owner" ? PEOPLE.owner : role === "admin" ? PEOPLE.admin : role === "management" ? PEOPLE.mgmt : PEOPLE.a), timezone: "UTC" };
  return {
    user,
    memberships: [{ workspace: { id: WS, name: "AheadTech360", slug: "aheadtech360" }, role }],
    aal: "aal2",
    mfa_required: false,
    two_factor_enabled: true,
    two_factor_required: role === "owner" || role === "admin",
  };
}

export function members(): Member[] {
  const rows: [UserSummary, Role][] = [
    [PEOPLE.owner, "owner"], [PEOPLE.admin, "admin"], [PEOPLE.mgmt, "management"], [PEOPLE.a, "member"],
    [PEOPLE.b, "member"], [PEOPLE.c, "member"], [PEOPLE.d, "member"], [PEOPLE.e, "guest"], [PEOPLE.f, "admin"],
  ];
  return rows.map(([user, role], i) => ({ user, role, joined_at: new Date(Date.now() - (i + 1) * 9 * 86_400_000).toISOString() }));
}

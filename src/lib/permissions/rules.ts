/*
 * One source of truth for what each workspace role can do. The role picker, the confirmation
 * dialog and the "What each role can do" panel all read from here, so the copy cannot drift from
 * the rules. The rules mirror the API's permission matrix test (ahead-one-api, tests/permissions.rs
 * and rbac.rs); the API is the authority and enforces them, this only describes them.
 *
 * Pure: no React, no "@/" imports, so `npm test` runs it under node:test.
 */

export type Role = "owner" | "admin" | "management" | "member" | "guest";

export const ROLE_ORDER: readonly Role[] = ["owner", "admin", "management", "member", "guest"];

export const ROLE_NAME: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  management: "Management",
  member: "Member",
  guest: "Guest",
};

/** "scoped" is a yes limited by something the Owner or the project sets. */
export type Grant = "yes" | "no" | "scoped";

export type CapabilityId =
  | "see_all_clients"
  | "manage_clients"
  | "invite_people"
  | "manage_roles"
  | "edit_tasks"
  | "comment_attach"
  | "see_dashboards"
  | "audit_log"
  | "android_app";

export type Capability = {
  id: CapabilityId;
  label: string;
  /** Short explanation of a role's cell, mostly for "scoped" grants. */
  note: Partial<Record<Role, string>>;
  grants: Record<Role, Grant>;
};

export const CAPABILITIES: readonly Capability[] = [
  {
    id: "see_all_clients",
    label: "See all clients",
    grants: { owner: "yes", admin: "scoped", management: "yes", member: "scoped", guest: "scoped" },
    note: {
      admin: "All clients, or only the ones the Owner picks",
      member: "Only projects they are added to, and open workspace projects",
      guest: "Only projects shared with them",
    },
  },
  {
    id: "manage_clients",
    label: "Manage clients and projects",
    grants: { owner: "yes", admin: "yes", management: "yes", member: "no", guest: "no" },
    note: {},
  },
  {
    id: "invite_people",
    label: "Invite people",
    grants: { owner: "yes", admin: "scoped", management: "no", member: "no", guest: "no" },
    note: { admin: "Management, Member and Guest, not Admins" },
  },
  {
    id: "manage_roles",
    label: "Manage roles",
    grants: { owner: "yes", admin: "scoped", management: "no", member: "no", guest: "no" },
    note: { admin: "Management, Member and Guest, not Admins" },
  },
  {
    id: "edit_tasks",
    label: "Create and edit tasks",
    grants: { owner: "yes", admin: "yes", management: "yes", member: "yes", guest: "no" },
    note: {},
  },
  {
    id: "comment_attach",
    label: "Comment and attach files",
    grants: { owner: "yes", admin: "yes", management: "yes", member: "yes", guest: "yes" },
    note: {},
  },
  {
    id: "see_dashboards",
    label: "Team dashboard",
    grants: { owner: "yes", admin: "yes", management: "yes", member: "no", guest: "no" },
    note: { member: "Sees their own Home", guest: "Sees their own Home" },
  },
  {
    id: "audit_log",
    label: "See the audit log",
    grants: { owner: "yes", admin: "yes", management: "no", member: "no", guest: "no" },
    note: {},
  },
  {
    id: "android_app",
    label: "Download the Android app",
    grants: { owner: "yes", admin: "yes", management: "yes", member: "yes", guest: "no" },
    note: {},
  },
];

/** The role's one-line description, used by the picker and the panel. */
export const ROLE_SUMMARY: Record<Role, string> = {
  owner: "Full control, including other Admins and every client",
  admin: "Invites people and manages clients, projects and roles up to Management",
  management: "Sees every client, manages projects, reads the team dashboard",
  member: "Works on the projects they are added to",
  guest: "Sees and comments only on projects shared with them",
};

/** Roles `actor` may hand out. Only the Owner can grant Admin; nobody grants Owner here. */
export function assignableRoles(actor: Role | undefined): Role[] {
  if (actor === "owner") return ["admin", "management", "member", "guest"];
  if (actor === "admin") return ["management", "member", "guest"];
  return [];
}

/** Whether `actor` can open the role editor for a person who currently holds `target`. */
export function canEditRole(actor: Role | undefined, target: Role, isSelf: boolean): boolean {
  if (isSelf || target === "owner") return false;
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "admin";
  return false;
}

export function grantFor(role: Role, cap: CapabilityId): Grant {
  return CAPABILITIES.find((c) => c.id === cap)!.grants[role];
}

export type RoleChangeCopy = {
  title: string;
  headline: string;
  gains: string[];
  loses: string[];
  /** True when the change removes authority (shown in a warning tone). */
  isDowngrade: boolean;
  confirmLabel: string;
};

const GAIN_PHRASE: Partial<Record<CapabilityId, string>> = {
  see_all_clients: "see every client",
  manage_clients: "manage clients and projects",
  invite_people: "invite people",
  manage_roles: "manage roles",
  edit_tasks: "create and edit tasks",
  see_dashboards: "see the team dashboard",
  audit_log: "see the audit log",
  android_app: "download the Android app",
};

const LOSE_PHRASE: Partial<Record<CapabilityId, string>> = {
  see_all_clients: "see every client",
  manage_clients: "manage clients and projects",
  invite_people: "invite people",
  manage_roles: "change roles",
  edit_tasks: "create and edit tasks (they can still comment)",
  see_dashboards: "see the team dashboard",
  audit_log: "see the audit log",
  android_app: "download the Android app",
};

const level = (g: Grant) => (g === "yes" ? 2 : g === "scoped" ? 1 : 0);

/** The words for the "change role" confirmation: what the person gains and loses. */
export function roleChangeCopy(name: string, from: Role, to: Role): RoleChangeCopy {
  const gains: string[] = [];
  const loses: string[] = [];
  for (const c of CAPABILITIES) {
    // An Admin's client scope is a separate setting (Client access), so a role change does not count it.
    const g = (r: Role) => (c.id === "see_all_clients" && r === "admin" ? "yes" : c.grants[r]);
    const before = level(g(from));
    const after = level(g(to));
    if (after > before) gains.push(GAIN_PHRASE[c.id] ?? c.label.toLowerCase());
    if (after < before) loses.push(LOSE_PHRASE[c.id] ?? c.label.toLowerCase());
  }
  const article = to === "admin" ? "an" : "a";
  return {
    title: `Make ${name} ${article} ${ROLE_NAME[to]}?`,
    headline: `${name} becomes ${article} ${ROLE_NAME[to]}.`,
    gains,
    loses,
    isDowngrade: ROLE_ORDER.indexOf(to) > ROLE_ORDER.indexOf(from),
    confirmLabel: `Make ${ROLE_NAME[to]}`,
  };
}

export function joinPhrases(items: string[]): string {
  if (items.length === 0) return "";
  if (items.length === 1) return items[0]!;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Friendly text for the API's refusals on a role change or removal. */
export function roleErrorMessage(status: number | undefined, apiMessage: string | undefined): string {
  const m = (apiMessage ?? "").toLowerCase();
  if (m.includes("at least one owner")) return "A workspace needs at least one Owner, so this change can't be made. Make someone else an Owner first.";
  if (m.includes("your own role") || m.includes("remove yourself")) return "You can't change your own role or remove yourself. Ask another Owner.";
  if (m.includes("already have that role")) return "They already have that role.";
  if (status === 403) return "Only an Owner can change Admins or the Owner role.";
  if (status === 404) return "That person is no longer in this workspace.";
  return apiMessage || "Something went wrong. Try again.";
}

/* ---------- Client access (which spaces an Admin sees) ---------- */

export type ClientAccess = { all_clients: boolean; space_ids: string[] };

export function clientAccessLabel(a: ClientAccess | undefined): string {
  if (!a) return "";
  if (a.all_clients) return "All clients";
  const n = a.space_ids.length;
  if (n === 0) return "No clients";
  return n === 1 ? "1 client" : `${n} clients`;
}

function sameSet(a: readonly string[], b: readonly string[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

/** Confirmation copy for a new client access: names exactly what the Admin loses. */
export function clientAccessChangeCopy(
  name: string,
  before: ClientAccess,
  next: ClientAccess,
  clientName: (id: string) => string,
  allIds: readonly string[],
): { title: string; lines: string[]; loses: string[]; noChange: boolean } {
  const had = new Set(before.all_clients ? allIds : before.space_ids);
  const will = new Set(next.all_clients ? allIds : next.space_ids);
  const lost = [...had].filter((id) => !will.has(id)).map(clientName);
  const gained = [...will].filter((id) => !had.has(id)).map(clientName);
  const lines: string[] = [];
  if (next.all_clients) lines.push(`${name} will see every client, including new ones.`);
  else if (will.size === 0) lines.push(`${name} will not see any client.`);
  else lines.push(`${name} will see ${will.size === 1 ? "1 client" : `${will.size} clients`} only.`);
  if (gained.length) lines.push(`Gains access to ${joinPhrases(gained)}.`);
  return {
    title: `Change client access for ${name}?`,
    lines,
    loses: lost,
    noChange: before.all_clients === next.all_clients && (next.all_clients || sameSet(before.space_ids, next.space_ids)),
  };
}

/** Audit actions that are about roles or client access. */
export function isAccessAction(action: string): boolean {
  return action === "member.role_changed" || action === "member.removed" || action.includes("client_access");
}

export function auditActionLabel(action: string): string {
  if (action === "member.role_changed") return "Role changed";
  if (action === "member.removed") return "Member removed";
  if (action.includes("client_access")) return "Client access changed";
  return action.replace(/[._]/g, " ");
}

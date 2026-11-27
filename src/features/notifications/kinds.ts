/*
 * One table for every notification kind: label, settings group, title format and deep link.
 * Pure (no React, no "@/" imports) so `npm test` can check it covers every kind in the generated
 * NotificationKind type. Icons live in kind-icons.tsx, keyed by the same type.
 *
 * `PendingKind` lists kinds the API is adding that the generated type may not have yet. Once
 * `npm run sync-types` brings them in they are part of NotificationKind and this alias is harmless.
 */

import { safeNext } from "../../lib/safe-next.ts";

export type PendingKind =
  | "channel_message"
  | "task_status_changed"
  | "added_to_project"
  | "role_changed"
  | "member_joined"
  | "file_expiring"
  | "invite_accepted"
  | "client_access_changed"
  | "project_archived"
  | "space_archived"
  | "app_connected";
export type KnownKind =
  | "task_assigned"
  | "mentioned"
  | "task_comment"
  | "task_due_soon"
  | "task_overdue"
  | "direct_message"
  | "app_update"
  | PendingKind;

export type KindGroup = "Messages" | "Mentions" | "Tasks" | "Team and access" | "System";
export const GROUP_ORDER: readonly KindGroup[] = ["Messages", "Mentions", "Tasks", "Team and access", "System"];

export type KindInfo = {
  /** Short tag on a row ("Message"). */
  label: string;
  /** Settings row title and description (the API's own title and description win when it sends them). */
  title: string;
  description: string;
  group: KindGroup;
  /** Fallback destination when a notification has no usable `link`. */
  fallback: (ctx: { conversationId?: string | null }) => string;
};

const inbox = () => "/inbox";
const chat = ({ conversationId }: { conversationId?: string | null }) => (conversationId ? `/messages/${encodeURIComponent(conversationId)}` : "/messages");

export const KIND_INFO: Record<KnownKind, KindInfo> = {
  direct_message: { label: "Message", title: "Direct messages", description: "New messages sent to you", group: "Messages", fallback: chat },
  channel_message: { label: "Channel", title: "Channel messages", description: "New messages in channels you are in", group: "Messages", fallback: chat },
  mentioned: { label: "Mention", title: "Mentions", description: "Someone @mentions you", group: "Mentions", fallback: inbox },
  task_assigned: { label: "Assigned", title: "Assigned to me", description: "Someone assigns you a task", group: "Tasks", fallback: () => "/my-tasks" },
  task_comment: { label: "Comment", title: "Comments", description: "New comments on tasks you follow", group: "Tasks", fallback: inbox },
  task_due_soon: { label: "Due soon", title: "Due soon", description: "Your tasks due in the next 24 hours", group: "Tasks", fallback: () => "/my-tasks" },
  task_overdue: { label: "Overdue", title: "Overdue", description: "Your tasks that pass their due date", group: "Tasks", fallback: () => "/my-tasks" },
  task_status_changed: { label: "Status", title: "Status changes", description: "A task you follow changes status", group: "Tasks", fallback: inbox },
  added_to_project: { label: "Project", title: "Added to a project", description: "You are added to a project", group: "Team and access", fallback: inbox },
  role_changed: { label: "Role", title: "Role changes", description: "Your role in the workspace changes", group: "Team and access", fallback: inbox },
  member_joined: { label: "Joined", title: "New members", description: "Someone joins the workspace", group: "Team and access", fallback: inbox },
  file_expiring: { label: "File", title: "Files about to expire", description: "A file you uploaded will be deleted soon for not being opened", group: "System", fallback: () => "/files" },
  invite_accepted: { label: "Invite", title: "Invites accepted", description: "Someone you invited joins the workspace", group: "Team and access", fallback: () => "/settings/members" },
  client_access_changed: { label: "Access", title: "Client access changes", description: "Your access to clients changes", group: "Team and access", fallback: inbox },
  project_archived: { label: "Archived", title: "Projects archived", description: "A project you are on is archived", group: "Team and access", fallback: inbox },
  space_archived: { label: "Archived", title: "Clients archived", description: "A client you work with is archived", group: "Team and access", fallback: inbox },
  app_connected: { label: "App", title: "Apps connected", description: "An AI app is connected to your account", group: "Team and access", fallback: () => "/settings/connected-apps" },
  app_update: { label: "App update", title: "App updates", description: "A new version of the app is available", group: "System", fallback: inbox },
};

const GENERIC: KindInfo = { label: "Update", title: "Update", description: "", group: "System", fallback: inbox };

/** Info for any kind, including one this build has never heard of (never throws, never shows a raw id as the label). */
export function kindInfo(kind: string): KindInfo {
  return (KIND_INFO as Record<string, KindInfo | undefined>)[kind] ?? GENERIC;
}

/** The server's `link` when `safeNext` accepts it (the app's one internal-link validator), else the kind's fallback. */
export function deepLink(kind: string, link: string | null | undefined, conversationId?: string | null): string {
  const fallback = kindInfo(kind).fallback({ conversationId });
  return safeNext(link, fallback);
}

export type PrefRow = { kind: string; title?: string | null; description?: string | null; group?: string | null };
type Shown<T> = T & { title: string; description: string };

/** Group preference rows for the settings screen, in GROUP_ORDER; API-sent title, description and group win over the table. */
export function groupPrefs<T extends PrefRow>(rows: readonly T[]): { group: string; rows: Shown<T>[] }[] {
  const by = new Map<string, Shown<T>[]>();
  for (const r of rows) {
    const info = kindInfo(r.kind);
    const group = r.group || info.group;
    const list = by.get(group) ?? [];
    list.push({ ...r, title: r.title || info.title, description: r.description ?? info.description });
    by.set(group, list);
  }
  const known = GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({ group: g as string, rows: by.get(g)! }));
  const extra = [...by.keys()].filter((g) => !GROUP_ORDER.includes(g as KindGroup)).map((g) => ({ group: g, rows: by.get(g)! }));
  return [...known, ...extra];
}

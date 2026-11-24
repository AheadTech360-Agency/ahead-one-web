"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { chatKeys, qk } from "@/lib/api/keys";
import type {
  Conversation,
  Member,
  MeResponse,
  Message,
  Notification,
  NotificationPrefs,
  UserSummary,
} from "@/lib/api/types";
import { ConversationList } from "@/features/messages/conversation-list";
import { ConversationView } from "@/features/messages/conversation-view";
import { MessagesDialogs } from "@/features/messages/dialogs";
import { MessagesIndex } from "@/features/messages/messages-index";
import { noteTyping, openMessagesDialog, pendingStore } from "@/features/messages/stores";
import { InboxView } from "@/features/notifications/inbox";

/* Development-only fixtures. Times are relative to now so day separators read naturally. */

const MIN = 60_000;
const now = Date.now();
const at = (minsAgo: number) => new Date(now - minsAgo * MIN).toISOString();

let seq = 0;
/** UUIDv7-shaped ids so string order is time order, like the API's. */
function v7(minsAgo: number) {
  const ms = (now - minsAgo * MIN).toString(16).padStart(12, "0");
  const n = (seq++).toString(16).padStart(12, "0");
  return `${ms.slice(0, 8)}-${ms.slice(8, 12)}-7000-8000-${n}`;
}

const u = (id: string, full_name: string, email: string): UserSummary => ({ id, full_name, email, avatar_url: null });
const ME = u("1f3a9c2e-5b7d-4e8f-9a1c-2d3e4f5a6b7c", "Jordan Ellis", "jordan@aheadtech360.com");
const MAYA = u("8c41d0a7-2e93-4b5f-a6c8-71e2f3d4c5b6", "Maya Okafor", "maya@aheadtech360.com");
const DANIEL = u("4be7f912-c3a0-4d68-b2e5-9f0a1c2d3e4f", "Daniel Reyes", "daniel@aheadtech360.com");
const PRIYA = u("d26c8e15-7f4b-4a39-8c0d-5e6f7a8b9c0d", "Priya Raman", "priya@aheadtech360.com");
const TOMAS = u("05a9b3c7-d1e2-4f60-b7a8-c9d0e1f2a3b4", "Tomás Alvarez", "tomas@aheadtech360.com");
const HANNAH = u("e7f81a2b-3c4d-4e5f-8061-728394a5b6c7", "Hannah Lindqvist", "hannah@aheadtech360.com");
const KENJI = u("6a0b1c2d-9e8f-4a7b-b6c5-d4e3f2a1b0c9", "Kenji Mori", "kenji@aheadtech360.com");
const PEOPLE = [ME, MAYA, DANIEL, PRIYA, TOMAS, HANNAH, KENJI];
const WS = "99999999-9999-4999-8999-999999999999";

const me: MeResponse = {
  user: { ...ME, timezone: "America/New_York" },
  memberships: [{ workspace: { id: WS, name: "AheadTech360", slug: "aheadtech360" }, role: "admin" }],
  aal: "aal2",
  mfa_required: false,
};
const members: Member[] = PEOPLE.map((p, i) => ({ user: p, role: i === 0 ? "admin" : "member", joined_at: at(60 * 24 * 90) }));

function msg(conv: string, author: UserSummary, minsAgo: number, body: string, extra: Partial<Message> = {}): Message {
  return {
    id: v7(minsAgo),
    conversation_id: conv,
    author,
    body,
    attachments: [],
    created_at: at(minsAgo),
    edited_at: null,
    deleted: false,
    ...extra,
  };
}

const C_LAUNCH = "aaaaaaa1-0000-4000-8000-000000000001";
const C_DESIGN = "aaaaaaa1-0000-4000-8000-000000000002";
const C_GENERAL = "aaaaaaa1-0000-4000-8000-000000000003";
const D_MAYA = "aaaaaaa1-0000-4000-8000-000000000004";
const D_DANIEL = "aaaaaaa1-0000-4000-8000-000000000005";
const D_PRIYA = "aaaaaaa1-0000-4000-8000-000000000006";
const C_EMPTY = "aaaaaaa1-0000-4000-8000-000000000007";

const launchMessages: Message[] = [
  msg(C_LAUNCH, DANIEL, 60 * 26, "Morning all. Client kickoff for the Northwind portal moved to Thursday 10:00."),
  msg(C_LAUNCH, PRIYA, 60 * 26 - 3, `Works for me. <@${ME.id}> can you send the updated agenda?`),
  msg(C_LAUNCH, ME, 60 * 25, "On it. Draft is in the project folder, I'll share once Daniel signs off."),
  msg(C_LAUNCH, MAYA, 62, "Staging deploy is green. Release notes are up for review."),
  msg(C_LAUNCH, MAYA, 61, "Two open items before we cut the build:\n1. SSO redirect on Safari\n2. The invoice export timeout", { edited_at: at(58) }),
  msg(C_LAUNCH, MAYA, 60, "", {
    attachments: [
      { id: "f1", filename: "release-notes-v2.4.pdf", mime: "application/pdf", size_bytes: 482_000, uploader: MAYA, created_at: at(60) },
      { id: "f2", filename: "qa-checklist.xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size_bytes: 61_400, uploader: MAYA, created_at: at(60) },
    ],
  }),
  msg(C_LAUNCH, TOMAS, 40, `I'll take the Safari redirect. <@${MAYA.id}> is the export timeout the one from last sprint?`),
  msg(C_LAUNCH, MAYA, 38, "Same one. It only shows up past 5,000 rows, details in https://aheadtech360.atlassian.net/browse/NW-212"),
  msg(C_LAUNCH, DANIEL, 12, "Deleted", { deleted: true, body: "" }),
  msg(C_LAUNCH, HANNAH, 9, `Heads up <@${ME.id}>: the client asked whether the export fix ships this week. Can we confirm by 3pm?`),
  msg(C_LAUNCH, HANNAH, 8, "Happy to write the reply once we know."),
];

const dmMaya: Message[] = [
  msg(D_MAYA, MAYA, 180, "Do you have ten minutes before standup?"),
  msg(D_MAYA, ME, 175, "Yes, grabbing coffee. Call in 5?"),
  msg(D_MAYA, MAYA, 174, "Perfect"),
  msg(D_MAYA, ME, 20, "Sent you the revised estimate for the portal, take a look when you can."),
];

function conv(id: string, kind: "dm" | "channel", rest: Partial<Conversation>): Conversation {
  return {
    id,
    workspace_id: WS,
    kind,
    name: null,
    topic: null,
    is_private: false,
    members: [],
    member_count: 2,
    is_member: true,
    created_by: ME.id,
    last_message: null,
    unread_count: 0,
    last_read_message_id: null,
    created_at: at(60 * 24 * 30),
    ...rest,
  };
}

const conversations: Conversation[] = [
  conv(C_LAUNCH, "channel", {
    name: "northwind-launch",
    topic: "Portal launch for Northwind Freight. Release on Friday.",
    member_count: 6,
    last_message: launchMessages.at(-1)!,
    unread_count: 3,
    last_read_message_id: launchMessages[7].id,
  }),
  conv(D_MAYA, "dm", { members: [ME, MAYA], last_message: dmMaya.at(-1)!, last_read_message_id: dmMaya.at(-1)!.id }),
  conv(D_DANIEL, "dm", {
    members: [ME, DANIEL],
    last_message: msg(D_DANIEL, DANIEL, 95, `Can you review the SOW before I send it? <@${ME.id}>`),
    unread_count: 1,
  }),
  conv(C_DESIGN, "channel", {
    name: "design-reviews",
    is_private: true,
    member_count: 4,
    last_message: msg(C_DESIGN, PRIYA, 60 * 5, "New dashboard mocks are in Figma, comments welcome."),
  }),
  conv(D_PRIYA, "dm", { members: [ME, PRIYA], last_message: msg(D_PRIYA, ME, 60 * 30, "Thanks, that fixed it.") }),
  conv(C_GENERAL, "channel", {
    name: "general",
    topic: "Company-wide announcements",
    member_count: 7,
    last_message: msg(C_GENERAL, KENJI, 60 * 24 * 3, "Office is closed Monday for the holiday."),
  }),
  conv(C_EMPTY, "channel", { name: "ops-oncall", topic: null, member_count: 3 }),
];

const browse: Conversation[] = [
  conv("bbbbbbb1-0000-4000-8000-000000000001", "channel", { name: "random", topic: "Links, lunch and everything else", member_count: 5, is_member: false }),
  conv("bbbbbbb1-0000-4000-8000-000000000002", "channel", { name: "sales-pipeline", topic: "Deals in flight", member_count: 3, is_member: false }),
];

const notif = (minsAgo: number, n: Partial<Notification>): Notification => ({
  id: v7(minsAgo),
  kind: "mentioned",
  title: "",
  body: "",
  link: "/inbox",
  actor: null,
  read_at: null,
  created_at: at(minsAgo),
  ...n,
});

const notifications: Notification[] = [
  notif(9, { kind: "mentioned", title: "Hannah Lindqvist mentioned you in #northwind-launch", body: "Heads up @Jordan Ellis: the client asked whether the export fix ships this week.", actor: HANNAH, link: `/messages/${C_LAUNCH}` }),
  notif(95, { kind: "direct_message", title: "New message from Daniel Reyes", body: "Can you review the SOW before I send it?", actor: DANIEL, link: `/messages/${D_DANIEL}` }),
  notif(130, { kind: "task_assigned", title: "Maya Okafor assigned you Fix invoice export timeout", body: "Northwind portal / Sprint 14", actor: MAYA }),
  notif(60 * 6, { kind: "task_due_soon", title: "Send kickoff agenda is due tomorrow", body: "Northwind portal", read_at: at(60 * 5) }),
  notif(60 * 26, { kind: "task_comment", title: "Priya Raman commented on Safari SSO redirect", body: "Repro steps are in the description now.", actor: PRIYA, read_at: at(60 * 20) }),
  notif(60 * 50, { kind: "task_overdue", title: "Update staging certificates is overdue", body: "Infrastructure", read_at: at(60 * 40) }),
];

const prefs: NotificationPrefs = {
  daily_digest: false,
  prefs: (["task_assigned", "mentioned", "task_comment", "task_due_soon", "task_overdue", "direct_message"] as const).map((kind) => ({
    kind,
    in_app: true,
    email: kind !== "direct_message" && kind !== "task_comment",
    push: true,
  })),
};

function seed(qc: QueryClient, empty: boolean) {
  qc.setQueryData(qk.me(), me);
  qc.setQueryData(qk.workspace(WS).members(), members);
  qc.setQueryData(qk.workspace(WS).conversations(), empty ? [] : conversations);
  qc.setQueryData(qk.workspace(WS).tree(false), []);
  qc.setQueryData(chatKeys.browse(WS), browse);
  const page = (items: Message[]) => ({ pages: [{ items: [...items].reverse(), next_cursor: null }], pageParams: [undefined] });
  qc.setQueryData(chatKeys.messages(C_LAUNCH), page(launchMessages));
  qc.setQueryData(chatKeys.messages(D_MAYA), page(dmMaya));
  qc.setQueryData(chatKeys.messages(C_EMPTY), page([]));
  qc.setQueryData(chatKeys.members(C_LAUNCH), [ME, MAYA, DANIEL, PRIYA, TOMAS, HANNAH]);
  qc.setQueryData(chatKeys.members(C_EMPTY), [ME, KENJI, TOMAS]);
  qc.setQueryData(chatKeys.readStates(D_MAYA), [
    { user_id: ME.id, last_read_message_id: dmMaya.at(-1)!.id },
    { user_id: MAYA.id, last_read_message_id: dmMaya.at(-1)!.id },
  ]);
  const list = (items: Notification[]) => ({ pages: [{ items, next_cursor: null }], pageParams: [undefined] });
  qc.setQueryData(qk.notifications.list(false), list(empty ? [] : notifications));
  qc.setQueryData(qk.notifications.list(true), list(empty ? [] : notifications.filter((n) => !n.read_at)));
  qc.setQueryData(qk.notifications.unreadCount(), { count: empty ? 0 : notifications.filter((n) => !n.read_at).length });
  qc.setQueryData(qk.notifications.prefs(), prefs);
}

export function MessagingMock() {
  // Fixtures use the clock, so render on the client only.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return mounted ? <Mock /> : null;
}

function Mock() {
  const params = useSearchParams();
  const view = params.get("view") ?? "conversation";
  const empty = params.get("empty") === "1";
  const c = params.get("c") ?? C_LAUNCH;
  const [qc] = useState(() => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false, refetchInterval: false } },
    });
    seed(client, empty);
    return client;
  });

  useEffect(() => {
    if (params.get("typing") === "1") {
      noteTyping(c, PRIYA);
      const t = setInterval(() => noteTyping(c, PRIYA), 3000);
      return () => clearInterval(t);
    }
  }, [params, c]);

  useEffect(() => {
    if (params.get("failed") === "1") {
      pendingStore.add({
        tempId: "tmp-demo",
        conversationId: c,
        body: "I'll confirm with QA and reply here by 2pm.",
        attachments: [],
        createdAt: new Date().toISOString(),
        status: "failed",
        error: "Can't reach the server. Check your connection and try again.",
      });
      return () => pendingStore.remove("tmp-demo");
    }
  }, [params, c]);

  useEffect(() => {
    const d = params.get("dialog");
    if (d === "dm" || d === "channel" || d === "browse") openMessagesDialog(d);
  }, [params]);

  return (
    <QueryClientProvider client={qc}>
      <AppShell>
        {view === "inbox" ? (
          <InboxView />
        ) : (
          <div className="grid h-full grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] md:grid-cols-[300px_minmax(0,1fr)]">
            <ConversationList activeId={view === "index" ? undefined : c} isIndex={view === "index"} />
            <div className="min-h-0 min-w-0">{view === "index" ? <MessagesIndex /> : <ConversationView conversationId={c} />}</div>
          </div>
        )}
        <MessagesDialogs />
      </AppShell>
    </QueryClientProvider>
  );
}

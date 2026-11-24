import { format, isSameDay, isToday, isYesterday } from "date-fns";
import type { Conversation, Message, UserSummary } from "@/lib/api/types";

export type People = Map<string, UserSummary>;

export function displayName(u: Pick<UserSummary, "full_name" | "email"> | null | undefined) {
  if (!u) return "Former member";
  return u.full_name || u.email;
}

export function firstName(u: Pick<UserSummary, "full_name" | "email"> | null | undefined) {
  const n = displayName(u);
  return n.includes("@") ? n.split("@")[0] : n.split(" ")[0];
}

/** The other person in a DM (or yourself in a note-to-self). */
export function dmPartner(c: Conversation, meId: string | undefined) {
  return c.members.find((m) => m.id !== meId) ?? c.members[0];
}

export function conversationName(c: Conversation, meId: string | undefined) {
  if (c.kind === "dm") return displayName(dmPartner(c, meId)) || "Direct message";
  return c.name ?? "untitled";
}

/** Label for headings and aria: "#design" or "Maya Chen". */
export function conversationLabel(c: Conversation, meId: string | undefined) {
  return c.kind === "channel" ? `#${conversationName(c, meId)}` : conversationName(c, meId);
}

/* ---------- Mentions ---------- */

const MENTION = /<@([0-9a-fA-F-]{36})>/g;

export type BodyPart =
  | { kind: "text"; text: string }
  | { kind: "mention"; id: string }
  | { kind: "link"; href: string; text: string };

const URL_RE = /\bhttps?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]'}]/g;

function splitLinks(text: string, out: BodyPart[]) {
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", text: text.slice(last, i) });
    out.push({ kind: "link", href: m[0], text: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", text: text.slice(last) });
}

/** Split a message body into text, `<@uuid>` mentions and http(s) links. */
export function parseBody(body: string): BodyPart[] {
  const out: BodyPart[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION)) {
    const i = m.index ?? 0;
    if (i > last) splitLinks(body.slice(last, i), out);
    out.push({ kind: "mention", id: m[1].toLowerCase() });
    last = i + m[0].length;
  }
  if (last < body.length) splitLinks(body.slice(last), out);
  return out;
}

/** Plain text with mentions as @Name, for previews and notifications. */
export function plainBody(body: string, people: People) {
  return body.replace(MENTION, (_, id: string) => `@${displayName(people.get(id.toLowerCase())) || "someone"}`);
}

export function previewOf(m: Message | null | undefined, people: People, meId: string | undefined) {
  if (!m) return null;
  if (m.deleted) return "Message deleted";
  const text = plainBody(m.body, people).replace(/\s+/g, " ").trim();
  const body =
    text ||
    (m.attachments.length === 1
      ? m.attachments[0].filename
      : m.attachments.length > 1
        ? `${m.attachments.length} files`
        : "");
  return m.author?.id === meId ? `You: ${body}` : body;
}

/**
 * Composer text uses readable "@Full Name" tokens; on send they become `<@uuid>`.
 * `mentions` maps the inserted label (without "@") to the user id.
 */
export function encodeMentions(text: string, mentions: Map<string, string>) {
  let out = text;
  // Longest labels first so "@Ana Li" doesn't eat "@Ana Lima".
  const labels = [...mentions.keys()].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(new RegExp(`@${escaped}(?![\\w])`, "g"), `<@${mentions.get(label)}>`);
  }
  return out;
}

/** Reverse of encodeMentions, for editing a sent message. */
export function decodeMentions(body: string, people: People) {
  const mentions = new Map<string, string>();
  const text = body.replace(MENTION, (_, raw: string) => {
    const id = raw.toLowerCase();
    const label = displayName(people.get(id));
    if (!people.has(id)) return `<@${id}>`;
    mentions.set(label, id);
    return `@${label}`;
  });
  return { text, mentions };
}

/* ---------- Time ---------- */

export function dayLabel(d: Date) {
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return format(d, sameYear ? "EEEE, MMMM d" : "EEEE, MMMM d, yyyy");
}

export function timeLabel(d: Date) {
  return format(d, "h:mm a");
}

/** Short stamp for the conversation list: time today, weekday this week, date otherwise. */
export function listStamp(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return "Yesterday";
  const days = (Date.now() - d.getTime()) / 86_400_000;
  if (days < 6) return format(d, "EEE");
  return format(d, d.getFullYear() === new Date().getFullYear() ? "MMM d" : "MMM d, yyyy");
}

/** Consecutive messages from one author within 5 minutes on the same day share a header. */
export function continues(prev: { author: UserSummary | null; created_at: string } | undefined, next: { author: UserSummary | null; created_at: string }) {
  if (!prev || !prev.author || !next.author || prev.author.id !== next.author.id) return false;
  const a = new Date(prev.created_at);
  const b = new Date(next.created_at);
  return isSameDay(a, b) && b.getTime() - a.getTime() < 5 * 60_000;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

export const CHANNEL_NAME = /^[a-z0-9][a-z0-9_-]{0,79}$/;

/** What the server will store: trimmed, no leading #, lowercase, spaces to dashes. */
export function normalizeChannelName(raw: string) {
  return raw.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-");
}

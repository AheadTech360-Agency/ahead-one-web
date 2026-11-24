import type { JsonValue } from "@/lib/api/types";

/*
 * The server's rich text allowlist, mirrored on the client. The editor is configured so it can
 * only produce these, and `sanitizeDoc` runs before every save as a second line of defence
 * (pasted content, autolinked bare domains), so a save never fails with 422.
 */

export const ALLOWED_NODES = new Set([
  "doc",
  "paragraph",
  "text",
  "heading",
  "bulletList",
  "orderedList",
  "listItem",
  "taskList",
  "taskItem",
  "blockquote",
  "codeBlock",
  "hardBreak",
  "horizontalRule",
  "mention",
]);
export const ALLOWED_MARKS = new Set(["bold", "italic", "strike", "code", "underline", "link"]);

export function safeHref(href: unknown): string | null {
  if (typeof href !== "string" || href.length > 2048) return null;
  try {
    const u = new URL(href);
    return u.protocol === "http:" || u.protocol === "https:" || u.protocol === "mailto:" ? u.toString() : null;
  } catch {
    return null;
  }
}

type Obj = { [k: string]: JsonValue };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function cleanMarks(marks: JsonValue | undefined): JsonValue[] | undefined {
  if (!Array.isArray(marks)) return undefined;
  const out: JsonValue[] = [];
  for (const m of marks) {
    if (!isObj(m) || typeof m.type !== "string" || !ALLOWED_MARKS.has(m.type)) continue;
    if (m.type === "link") {
      const href = safeHref(isObj(m.attrs) ? m.attrs.href : null);
      if (href) out.push({ type: "link", attrs: { href } });
    } else out.push({ type: m.type });
  }
  return out.length ? out.slice(0, 8) : undefined;
}

/** Unknown nodes are unwrapped into their children (or dropped when they have none). */
function cleanNode(node: JsonValue): JsonValue[] {
  if (!isObj(node) || typeof node.type !== "string") return [];
  const type = node.type;
  const kids = Array.isArray(node.content) ? node.content.flatMap(cleanNode) : [];
  if (!ALLOWED_NODES.has(type)) return kids;
  if (type === "text") {
    if (typeof node.text !== "string" || node.text === "") return [];
    const marks = cleanMarks(node.marks);
    return [marks ? { type, text: node.text, marks } : { type, text: node.text }];
  }
  const out: Obj = { type };
  const attrs = isObj(node.attrs) ? node.attrs : {};
  if (type === "heading") {
    const level = Number(attrs.level);
    out.attrs = { level: level >= 1 && level <= 3 ? level : 3 };
  } else if (type === "taskItem") {
    out.attrs = { checked: attrs.checked === true };
  } else if (type === "mention") {
    if (typeof attrs.id !== "string") return [];
    out.attrs = { id: attrs.id, label: typeof attrs.label === "string" ? attrs.label.slice(0, 120) : "" };
    return [out];
  } else if (type === "orderedList" && typeof attrs.start === "number") {
    out.attrs = { start: Math.min(Math.max(1, attrs.start), 100_000) };
  } else if (type === "codeBlock") {
    const lang = attrs.language;
    out.attrs = { language: typeof lang === "string" && /^[A-Za-z0-9+-]{1,32}$/.test(lang) ? lang : null };
  }
  if (kids.length) out.content = kids;
  return [out];
}

export function sanitizeDoc(doc: JsonValue): JsonValue {
  const [clean] = cleanNode(doc);
  if (!isObj(clean) || clean.type !== "doc") return { type: "doc", content: [{ type: "paragraph" }] };
  return clean;
}

/** Plain text of a doc, used to decide whether it is empty. */
export function docText(doc: JsonValue | null | undefined): string {
  if (!isObj(doc)) return "";
  if (doc.type === "text" && typeof doc.text === "string") return doc.text;
  if (doc.type === "mention" && isObj(doc.attrs)) return `@${String(doc.attrs.label ?? "")}`;
  return Array.isArray(doc.content) ? doc.content.map((c) => docText(c)).join(doc.type === "doc" ? "\n" : "") : "";
}

export function isEmptyDoc(doc: JsonValue | null | undefined) {
  return docText(doc).trim() === "";
}

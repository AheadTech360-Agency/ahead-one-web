import { Check } from "lucide-react";
import type { JsonValue } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { safeHref } from "./schema";

/*
 * Read-only renderer for stored rich text. Builds React elements from the allowlisted schema
 * (never injects HTML), so a stored document can't run script or style the page.
 */

type Obj = { [k: string]: JsonValue };
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

export const proseClass =
  "text-13 leading-6 text-fg [overflow-wrap:anywhere] " +
  "[&_p]:my-1.5 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 " +
  "[&_h1]:mb-2 [&_h1]:mt-5 [&_h1]:text-20 [&_h1]:font-semibold [&_h1]:tracking-[-0.01em] " +
  "[&_h2]:mb-1.5 [&_h2]:mt-4 [&_h2]:text-16 [&_h2]:font-semibold " +
  "[&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-14 [&_h3]:font-semibold " +
  "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 [&_li>p]:my-0 " +
  "[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0.5 " +
  "[&_ul[data-type=taskList]>li]:my-1 [&_ul[data-type=taskList]>li]:flex [&_ul[data-type=taskList]>li]:items-start [&_ul[data-type=taskList]>li]:gap-2 " +
  "[&_ul[data-type=taskList]>li>label]:mt-[3px] [&_ul[data-type=taskList]>li>label]:flex [&_ul[data-type=taskList]>li>label]:shrink-0 " +
  "[&_ul[data-type=taskList]>li>div]:min-w-0 [&_ul[data-type=taskList]>li>div]:flex-1 [&_ul[data-type=taskList]>li>div>p]:my-0 " +
  "[&_input[type=checkbox]]:size-3.5 [&_input[type=checkbox]]:cursor-pointer [&_input[type=checkbox]]:accent-[var(--green)] " +
  "[&_li[data-checked=true]>div]:text-fg-muted [&_li[data-checked=true]>div]:line-through [&_li[data-checked=true]>div]:decoration-fg-faint " +
  "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border-strong [&_blockquote]:pl-3 [&_blockquote]:text-fg-muted " +
  "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-surface-sunken [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-12 [&_pre]:leading-5 " +
  "[&_:not(pre)>code]:rounded-xs [&_:not(pre)>code]:bg-surface-sunken [&_:not(pre)>code]:px-1 [&_:not(pre)>code]:py-px [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-12 " +
  "[&_a]:text-accent-text [&_a]:underline [&_a]:decoration-[color-mix(in_srgb,currentColor_40%,transparent)] hover:[&_a]:decoration-current " +
  "[&_hr]:my-4 [&_hr]:border-border " +
  "[&_.mention]:rounded-xs [&_.mention]:bg-accent-subtle [&_.mention]:px-1 [&_.mention]:font-medium [&_.mention]:text-accent-text";

function marksWrap(text: React.ReactNode, marks: JsonValue | undefined, key: string): React.ReactNode {
  if (!Array.isArray(marks)) return text;
  let out = text;
  marks.forEach((m, i) => {
    if (!isObj(m)) return;
    const k = `${key}-m${i}`;
    switch (m.type) {
      case "bold":
        out = <strong key={k}>{out}</strong>;
        break;
      case "italic":
        out = <em key={k}>{out}</em>;
        break;
      case "strike":
        out = <s key={k}>{out}</s>;
        break;
      case "underline":
        out = <u key={k}>{out}</u>;
        break;
      case "code":
        out = <code key={k}>{out}</code>;
        break;
      case "link": {
        const href = safeHref(isObj(m.attrs) ? m.attrs.href : null);
        if (href) {
          out = (
            <a key={k} href={href} target="_blank" rel="noopener noreferrer nofollow">
              {out}
            </a>
          );
        }
        break;
      }
    }
  });
  return out;
}

function renderNodes(nodes: JsonValue | undefined, key: string): React.ReactNode[] {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((n, i) => renderNode(n, `${key}.${i}`));
}

function renderNode(node: JsonValue, key: string): React.ReactNode {
  if (!isObj(node)) return null;
  const kids = renderNodes(node.content, key);
  const attrs = isObj(node.attrs) ? node.attrs : {};
  switch (node.type) {
    case "doc":
      return <>{kids}</>;
    case "text":
      return typeof node.text === "string" ? <span key={key}>{marksWrap(node.text, node.marks, key)}</span> : null;
    case "paragraph":
      return <p key={key}>{kids.length ? kids : <br />}</p>;
    case "heading": {
      const level = Number(attrs.level);
      if (level === 1) return <h1 key={key}>{kids}</h1>;
      if (level === 2) return <h2 key={key}>{kids}</h2>;
      return <h3 key={key}>{kids}</h3>;
    }
    case "bulletList":
      return <ul key={key}>{kids}</ul>;
    case "orderedList":
      return (
        <ol key={key} start={typeof attrs.start === "number" ? attrs.start : undefined}>
          {kids}
        </ol>
      );
    case "listItem":
      return <li key={key}>{kids}</li>;
    case "taskList":
      return (
        <ul key={key} data-type="taskList">
          {kids}
        </ul>
      );
    case "taskItem": {
      const checked = attrs.checked === true;
      return (
        <li key={key} data-type="taskItem" data-checked={checked}>
          <label aria-label={checked ? "Done" : "Not done"}>
            <span
              aria-hidden
              className={cn(
                "flex size-3.5 items-center justify-center rounded-xs border",
                checked ? "border-green bg-green text-navy-deep" : "border-border-strong",
              )}
            >
              {checked && <Check className="size-2.5" strokeWidth={3} />}
            </span>
          </label>
          <div>{kids}</div>
        </li>
      );
    }
    case "blockquote":
      return <blockquote key={key}>{kids}</blockquote>;
    case "codeBlock":
      return (
        <pre key={key}>
          <code>{kids}</code>
        </pre>
      );
    case "hardBreak":
      return <br key={key} />;
    case "horizontalRule":
      return <hr key={key} />;
    case "mention":
      return (
        <span key={key} className="mention" data-id={typeof attrs.id === "string" ? attrs.id : undefined}>
          @{typeof attrs.label === "string" ? attrs.label : "someone"}
        </span>
      );
    default:
      return kids.length ? <span key={key}>{kids}</span> : null;
  }
}

export function RichTextView({ doc, className }: { doc: JsonValue | null | undefined; className?: string }) {
  return <div className={cn(proseClass, className)}>{renderNode(doc ?? null, "r")}</div>;
}

"use client";

import Mention from "@tiptap/extension-mention";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, ReactRenderer, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Quote,
  SquareCode,
  Strikethrough,
  Underline,
} from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { JsonValue, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/ui/popover";
import { Tooltip } from "@/ui/tooltip";
import { MentionList, type MentionListHandle } from "./mention-list";
import { proseClass } from "./rich-text-view";
import { safeHref, sanitizeDoc } from "./schema";

/*
 * Tiptap configured to the server's allowlist: StarterKit (no image exists in it) with headings
 * 1 to 3 and links limited to http, https and mailto, plus task lists, placeholder and @mentions.
 * Nothing else is registered, so pasted content outside the schema is dropped by ProseMirror.
 */

export type RichTextEditorHandle = {
  focus: () => void;
  clear: () => void;
  setContent: (doc: JsonValue) => void;
  getJSON: () => JsonValue;
  isEmpty: () => boolean;
};

type Props = {
  initial: JsonValue | null | undefined;
  members: UserSummary[];
  placeholder?: string;
  editable?: boolean;
  variant?: "full" | "compact";
  autofocus?: boolean;
  "aria-label": string;
  className?: string;
  onChange?: (doc: JsonValue) => void;
  onBlur?: () => void;
  /** Mod+Enter. */
  onSubmit?: () => void;
  /** Escape while no suggestion is open. */
  onCancel?: () => void;
};

type Callbacks = Pick<Props, "members" | "onChange" | "onBlur" | "onSubmit" | "onCancel">;

/** Holds the latest props for Tiptap's long-lived callbacks. */
class Bridge {
  private cb: Callbacks = { members: [] };
  private open = false;
  private live = false;
  /** Init transactions (trailing node, normalisation) are not edits; only count changes after this. */
  goLive() {
    this.live = true;
  }
  isLive() {
    return this.live;
  }
  set(cb: Callbacks) {
    this.cb = cb;
  }
  get() {
    return this.cb;
  }
  suggesting(on: boolean) {
    this.open = on;
  }
  isSuggesting() {
    return this.open;
  }
}

function isAllowedUri(url: string) {
  return safeHref(url) !== null;
}

export const RichTextEditor = forwardRef<RichTextEditorHandle, Props>(function RichTextEditor(
  {
    initial,
    members,
    placeholder,
    editable = true,
    variant = "full",
    autofocus,
    className,
    onChange,
    onBlur,
    onSubmit,
    onCancel,
    "aria-label": ariaLabel,
  },
  ref,
) {
  // Callbacks and members change between renders; the editor is created once and reads them
  // through this bridge.
  const [bridge] = useState(() => new Bridge());
  useEffect(() => {
    bridge.set({ members, onChange, onBlur, onSubmit, onCancel });
  });

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    autofocus: autofocus ? "end" : false,
    content: (initial as object | null) ?? undefined,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          linkOnPaste: true,
          defaultProtocol: "https",
          protocols: ["mailto"],
          isAllowedUri: (url) => isAllowedUri(url),
          shouldAutoLink: (url) => isAllowedUri(url) || isAllowedUri(`https://${url}`),
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: "_blank" },
        },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? "" }),
      Mention.configure({
        HTMLAttributes: { class: "mention" },
        suggestion: {
          char: "@",
          items: ({ query }) => {
            const q = query.toLowerCase();
            return bridge.get().members
              .filter((m) => `${m.full_name} ${m.email}`.toLowerCase().includes(q))
              .slice(0, 8);
          },
          render: () => {
            let component: ReactRenderer<MentionListHandle> | null = null;
            let host: HTMLDivElement | null = null;
            const place = (rect: DOMRect | null | undefined) => {
              if (!host || !rect) return;
              const below = rect.bottom + 6;
              const tooLow = below + 280 > window.innerHeight;
              host.style.left = `${Math.min(rect.left, window.innerWidth - 272)}px`;
              host.style.top = tooLow ? "" : `${below}px`;
              host.style.bottom = tooLow ? `${window.innerHeight - rect.top + 6}px` : "";
            };
            return {
              onStart: (props) => {
                bridge.suggesting(true);
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                host = document.createElement("div");
                host.style.position = "fixed";
                host.style.zIndex = "var(--z-popover)";
                host.appendChild(component.element);
                document.body.appendChild(host);
                place(props.clientRect?.());
              },
              onUpdate: (props) => {
                component?.updateProps(props);
                place(props.clientRect?.());
              },
              onKeyDown: ({ event }) => {
                if (event.key === "Escape") {
                  host?.remove();
                  return true;
                }
                return component?.ref?.onKeyDown(event) ?? false;
              },
              onExit: () => {
                bridge.suggesting(false);
                host?.remove();
                component?.destroy();
                host = null;
                component = null;
              },
            };
          },
        },
      }),
    ],
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        "aria-multiline": "true",
        role: "textbox",
        class: cn(
          proseClass,
          "outline-none [&_.is-editor-empty:first-child]:before:pointer-events-none [&_.is-editor-empty:first-child]:before:float-left [&_.is-editor-empty:first-child]:before:h-0 [&_.is-editor-empty:first-child]:before:text-fg-faint [&_.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          variant === "full" ? "min-h-24" : "min-h-10",
        ),
      },
      handleKeyDown: (_view, event) => {
        if (bridge.isSuggesting()) return false;
        const cb = bridge.get();
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && cb.onSubmit) {
          event.preventDefault();
          cb.onSubmit();
          return true;
        }
        if (event.key === "Escape" && cb.onCancel) {
          cb.onCancel();
          return true;
        }
        return false;
      },
    },
    onCreate: () => window.setTimeout(() => bridge.goLive(), 0),
    onUpdate: ({ editor }) => {
      if (bridge.isLive()) bridge.get().onChange?.(sanitizeDoc(editor.getJSON() as JsonValue));
    },
    onBlur: () => bridge.get().onBlur?.(),
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus("end"),
      clear: () => editor?.commands.clearContent(true),
      setContent: (doc) => editor?.commands.setContent(doc as object, { emitUpdate: true }),
      getJSON: () => sanitizeDoc((editor?.getJSON() ?? { type: "doc" }) as JsonValue),
      isEmpty: () => !editor || editor.getText().trim() === "",
    }),
    [editor],
  );

  return (
    <div className={cn("flex flex-col", className)}>
      {editable && editor && variant === "full" && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
});

function ToolButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        className={cn(
          "inline-flex size-7 items-center justify-center rounded-xs text-fg-muted hover:bg-hover hover:text-fg [&_svg]:size-3.5",
          "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
          active && "bg-active text-fg",
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
      h2: e.isActive("heading", { level: 2 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      task: e.isActive("taskList"),
      quote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
    }),
  });
  const c = () => editor.chain().focus();
  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="-mx-1 mb-1 flex flex-wrap items-center gap-0.5 border-b border-border-subtle pb-1"
    >
      <ToolButton label="Bold" active={s.bold} onClick={() => c().toggleBold().run()}>
        <Bold aria-hidden />
      </ToolButton>
      <ToolButton label="Italic" active={s.italic} onClick={() => c().toggleItalic().run()}>
        <Italic aria-hidden />
      </ToolButton>
      <ToolButton label="Underline" active={s.underline} onClick={() => c().toggleUnderline().run()}>
        <Underline aria-hidden />
      </ToolButton>
      <ToolButton label="Strikethrough" active={s.strike} onClick={() => c().toggleStrike().run()}>
        <Strikethrough aria-hidden />
      </ToolButton>
      <ToolButton label="Inline code" active={s.code} onClick={() => c().toggleCode().run()}>
        <Code aria-hidden />
      </ToolButton>
      <LinkButton editor={editor} active={s.link} />
      <span aria-hidden className="mx-1 h-4 w-px bg-border" />
      <ToolButton label="Heading" active={s.h2} onClick={() => c().toggleHeading({ level: 2 }).run()}>
        <Heading2 aria-hidden />
      </ToolButton>
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => c().toggleBulletList().run()}>
        <List aria-hidden />
      </ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => c().toggleOrderedList().run()}>
        <ListOrdered aria-hidden />
      </ToolButton>
      <ToolButton label="Checklist" active={s.task} onClick={() => c().toggleTaskList().run()}>
        <ListChecks aria-hidden />
      </ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => c().toggleBlockquote().run()}>
        <Quote aria-hidden />
      </ToolButton>
      <ToolButton label="Code block" active={s.codeBlock} onClick={() => c().toggleCodeBlock().run()}>
        <SquareCode aria-hidden />
      </ToolButton>
    </div>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply(e: React.FormEvent) {
    e.preventDefault();
    const raw = href.trim();
    if (!raw) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    const withScheme = /^[a-z]+:/i.test(raw) ? raw : `https://${raw}`;
    const safe = safeHref(withScheme);
    if (!safe) {
      setError("Use a web address (https://) or an email link (mailto:).");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: safe }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setHref((editor.getAttributes("link").href as string | undefined) ?? "");
          setError(null);
        }
        setOpen(o);
      }}
    >
      <PopoverAnchor asChild>
        <span className="inline-flex">
          <ToolButton label="Link" active={active} onClick={() => setOpen((o) => !o)}>
            <Link2 aria-hidden />
          </ToolButton>
        </span>
      </PopoverAnchor>
      <PopoverContent className="w-72 p-2">
        <form onSubmit={apply} className="flex flex-col gap-2">
          <Input
            autoFocus
            aria-label="Link address"
            placeholder="https://"
            value={href}
            aria-invalid={error ? true : undefined}
            onChange={(e) => {
              setHref(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p role="alert" className="text-12 text-danger-text">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-1.5">
            {active && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  editor.chain().focus().extendMarkRange("link").unsetLink().run();
                  setOpen(false);
                }}
              >
                Remove link
              </Button>
            )}
            <Button size="sm" variant="primary" type="submit">
              Save link
            </Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

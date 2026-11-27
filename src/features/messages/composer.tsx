"use client";

import { ArrowUp, AtSign, CircleAlert, FileText, Paperclip, RotateCw, X } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { errorMessage } from "@/lib/api/client";
import type { Attachment, UserSummary } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { Avatar } from "@/ui/avatar";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";
import { RecordIconButton } from "@/features/recorder/record-button";
import { useRealtimeSend } from "@/features/realtime/provider";
import { VOICE_ENABLED } from "@/features/voice/contract";
import { useVoiceMessage } from "@/features/voice/voice-composer";
import { ACCEPT, checkFile } from "@/lib/files/limits";
import { MAX_ATTACHMENTS, uploadAttachment } from "./api";
import { displayName, encodeMentions, formatBytes } from "./format";

const MAX_LEN = 4000;
const TYPING_EVERY = 2_000;

type Upload = {
  key: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  attachment?: Attachment;
  error?: string;
  controller: AbortController;
};

type Draft = { text: string; mentions: [string, string][] };
const drafts = new Map<string, Draft>();

export type ComposerHandle = { addFiles: (files: File[]) => void; focus: () => void };

type Props = {
  conversationId: string;
  /** People who can be @mentioned here (conversation members). */
  candidates: UserSummary[];
  meId?: string;
  placeholder: string;
  /** Where a screen recording made from here is going, e.g. "#launch". Omit to hide the record button. */
  recordLabel?: string;
  mode?: "new" | "edit";
  initialText?: string;
  initialMentions?: Map<string, string>;
  onSubmit: (body: string, attachments: Attachment[]) => void;
  onCancel?: () => void;
  /** Up arrow in an empty composer: edit your last message. */
  onEditLast?: () => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

/** Text before the caret that is an @mention in progress: "@ma" -> "ma". */
function mentionQuery(text: string, caret: number) {
  const before = text.slice(0, caret);
  const m = /(^|\s)@([^\s@]{0,30}(?: [^\s@]{0,30})?)$/.exec(before);
  if (!m) return null;
  return { query: m[2], start: caret - m[2].length - 1 };
}

export const Composer = forwardRef<ComposerHandle, Props>(function Composer(
  {
    conversationId,
    candidates,
    meId,
    placeholder,
    recordLabel,
    mode = "new",
    initialText,
    initialMentions,
    onSubmit,
    onCancel,
    onEditLast,
    disabled,
    autoFocus,
  },
  ref,
) {
  const isEdit = mode === "edit";
  const [text, setText] = useState(() =>
    isEdit ? (initialText ?? "") : (drafts.get(conversationId)?.text ?? ""),
  );
  const mentions = useRef<Map<string, string>>(
    isEdit ? new Map(initialMentions) : new Map(drafts.get(conversationId)?.mentions ?? []),
  );
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [popup, setPopup] = useState<{ query: string; start: number } | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const lastTyping = useRef(0);
  const sendFrame = useRealtimeSend();
  const listId = useId();

  // Keep the draft per conversation so switching away and back loses nothing.
  useEffect(() => {
    if (isEdit) return;
    if (text) drafts.set(conversationId, { text, mentions: [...mentions.current] });
    else drafts.delete(conversationId);
  }, [conversationId, isEdit, text]);

  // Abort in-flight uploads on unmount.
  const uploadsRef = useRef(uploads);
  useEffect(() => {
    uploadsRef.current = uploads;
  });
  useEffect(() => () => uploadsRef.current.forEach((u) => u.status === "uploading" && u.controller.abort()), []);

  useLayoutEffect(() => {
    const el = area.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [text]);

  useEffect(() => {
    if (!autoFocus) return;
    const el = area.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);

  const matches = useMemo(() => {
    if (!popup) return [];
    const q = popup.query.toLowerCase();
    return candidates
      .filter((u) => u.id !== meId)
      .map((u) => {
        const name = displayName(u).toLowerCase();
        const score = name.startsWith(q) ? 0 : name.split(" ").some((w) => w.startsWith(q)) ? 1 : name.includes(q) || u.email.toLowerCase().includes(q) ? 2 : 3;
        return { u, score };
      })
      .filter((x) => x.score < 3)
      .sort((a, b) => a.score - b.score || displayName(a.u).localeCompare(displayName(b.u)))
      .slice(0, 6)
      .map((x) => x.u);
  }, [popup, candidates, meId]);
  const popupOpen = popup !== null && matches.length > 0;

  const addFiles = useCallback(
    (files: File[]) => {
      if (isEdit || files.length === 0) return;
      const room = MAX_ATTACHMENTS - uploadsRef.current.length;
      if (room <= 0) {
        toast.error(`You can attach up to ${MAX_ATTACHMENTS} files to one message.`);
        return;
      }
      const accepted: File[] = [];
      for (const f of files.slice(0, room)) {
        const problem = checkFile(f);
        if (problem) toast.error(problem, { description: "Files up to 25 MB, video and audio up to 100 MB." });
        else accepted.push(f);
      }
      if (files.length > room) toast.error(`Only the first ${room} files were added. Messages hold up to ${MAX_ATTACHMENTS}.`);
      for (const file of accepted) startUpload(file);
      area.current?.focus();
    },
    // startUpload is stable for this conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEdit, conversationId],
  );

  function startUpload(file: File, key = `${file.name}-${Date.now()}-${Math.random()}`) {
    const controller = new AbortController();
    setUploads((u) => {
      const existing = u.find((x) => x.key === key);
      const item: Upload = { key, file, progress: 0, status: "uploading", controller };
      return existing ? u.map((x) => (x.key === key ? item : x)) : [...u, item];
    });
    const patch = (p: Partial<Upload>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...p } : x)));
    uploadAttachment(conversationId, file, (progress) => patch({ progress }), controller.signal)
      .then((attachment) => patch({ status: "done", progress: 1, attachment }))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        patch({ status: "error", error: errorMessage(e, "The upload didn't finish.") });
      });
  }

  function removeUpload(key: string) {
    setUploads((u) => {
      u.find((x) => x.key === key)?.controller.abort();
      return u.filter((x) => x.key !== key);
    });
  }

  useImperativeHandle(ref, () => ({ addFiles, focus: () => area.current?.focus() }), [addFiles]);

  // Voice: a finished, uploaded recording goes out at once as a message with an empty body.
  const voice = useVoiceMessage(conversationId, (att) => onSubmit("", [att]));
  const voiceOn = VOICE_ENABLED && !isEdit && !disabled;

  const busy = uploads.some((u) => u.status === "uploading");
  const failedUploads = uploads.some((u) => u.status === "error");
  const trimmed = text.trim();
  const tooLong = text.length > MAX_LEN;
  const canSend = !disabled && !busy && !failedUploads && !tooLong && (trimmed.length > 0 || (!isEdit && uploads.length > 0));

  function submit() {
    if (!canSend) {
      if (busy) toast("Wait for the files to finish uploading, then send.");
      else if (failedUploads) toast.error("Remove or retry the files that didn't upload, then send.");
      return;
    }
    // Drop mention labels the user deleted from the text.
    for (const label of [...mentions.current.keys()]) if (!text.includes(`@${label}`)) mentions.current.delete(label);
    const body = encodeMentions(trimmed, mentions.current);
    const attachments = uploads.flatMap((u) => (u.attachment ? [u.attachment] : []));
    onSubmit(body, attachments);
    if (!isEdit) {
      setText("");
      mentions.current = new Map();
      setUploads([]);
      drafts.delete(conversationId);
      lastTyping.current = 0;
    }
  }

  function pick(u: UserSummary) {
    if (!popup || !area.current) return;
    const label = displayName(u);
    const caret = area.current.selectionStart;
    const next = `${text.slice(0, popup.start)}@${label} ${text.slice(caret)}`;
    mentions.current.set(label, u.id);
    setText(next);
    setPopup(null);
    const pos = popup.start + label.length + 2;
    requestAnimationFrame(() => {
      area.current?.focus();
      area.current?.setSelectionRange(pos, pos);
    });
  }

  function syncPopup(value: string, caret: number) {
    const q = mentionQuery(value, caret);
    setPopup(q);
    if (q?.query !== popup?.query) setHighlight(0);
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    syncPopup(value, e.target.selectionStart);
    if (!isEdit && value.trim() && Date.now() - lastTyping.current > TYPING_EVERY) {
      if (sendFrame({ type: "typing", conversation_id: conversationId })) lastTyping.current = Date.now();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return;
    if (popupOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const d = e.key === "ArrowDown" ? 1 : -1;
        setHighlight((h) => (h + d + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(matches[highlight] ?? matches[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setPopup(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      submit();
      return;
    }
    if (e.key === "Escape" && isEdit) {
      e.preventDefault();
      e.stopPropagation();
      onCancel?.();
      return;
    }
    if (e.key === "ArrowUp" && !isEdit && text === "" && uploads.length === 0 && onEditLast) {
      e.preventDefault();
      onEditLast();
    }
  }

  function onPaste(e: React.ClipboardEvent) {
    const files = [...e.clipboardData.files];
    if (files.length && !isEdit) {
      e.preventDefault();
      addFiles(files);
    }
  }

  const remaining = MAX_LEN - text.length;

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (isEdit || !e.dataTransfer.types.includes("Files")) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(e) => {
        if (isEdit) return;
        e.preventDefault();
        setDragging(false);
        addFiles([...e.dataTransfer.files]);
      }}
    >
      {popupOpen && (
        <div
          id={listId}
          role="listbox"
          aria-label="People to mention"
          className="absolute bottom-full left-0 z-[var(--z-popover)] mb-1.5 w-72 max-w-full rounded-md border border-border bg-surface-raised p-1 shadow-popover animate-in-pop"
        >
          {matches.map((u, i) => (
            <div
              key={u.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === highlight}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(u);
              }}
              onMouseEnter={() => setHighlight(i)}
              className={cn(
                "flex h-9 cursor-default items-center gap-2 rounded-xs px-2 text-13",
                i === highlight ? "bg-hover" : "",
              )}
            >
              <Avatar user={u} size="sm" decorative />
              <span className="min-w-0 flex-1 truncate text-fg">{displayName(u)}</span>
              {u.full_name && <span className="max-w-[40%] truncate text-12 text-fg-faint">{u.email}</span>}
            </div>
          ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-md border bg-surface transition-[border-color,box-shadow] duration-[var(--dur-fast)]",
          "focus-within:border-ring",
          dragging ? "border-ring border-dashed bg-accent-subtle" : "border-border-strong",
        )}
      >
        {uploads.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 px-2 pt-2" aria-label="Attachments">
            {uploads.map((u) => (
              <li
                key={u.key}
                className={cn(
                  "flex h-11 w-56 max-w-full items-center gap-2 rounded-sm border px-2",
                  u.status === "error" ? "border-danger bg-danger-subtle" : "border-border bg-surface-sunken",
                )}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-xs bg-surface text-fg-muted">
                  {u.status === "uploading" ? (
                    <Spinner size={14} label={`Uploading ${u.file.name}`} />
                  ) : u.status === "error" ? (
                    <CircleAlert className="size-4 text-danger-text" aria-hidden />
                  ) : (
                    <FileText className="size-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-12 font-medium text-fg">{u.file.name}</span>
                  <span className={cn("block truncate text-11 tabular", u.status === "error" ? "text-danger-text" : "text-fg-faint")}>
                    {u.status === "uploading"
                      ? `${Math.round(u.progress * 100)}% of ${formatBytes(u.file.size)}`
                      : u.status === "error"
                        ? u.error
                        : formatBytes(u.file.size)}
                  </span>
                </span>
                {u.status === "error" && (
                  <IconButton label={`Retry ${u.file.name}`} size="sm" className="size-6" onClick={() => startUpload(u.file, u.key)}>
                    <RotateCw aria-hidden />
                  </IconButton>
                )}
                <IconButton label={`Remove ${u.file.name}`} size="sm" className="size-6" onClick={() => removeUpload(u.key)}>
                  <X aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
        {voiceOn && voice.active && voice.strip}
        <label className="sr-only" htmlFor={`${listId}-input`}>
          {placeholder}
        </label>
        <textarea
          id={`${listId}-input`}
          ref={area}
          rows={1}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) syncPopup(e.currentTarget.value, e.currentTarget.selectionStart);
          }}
          onClick={(e) => syncPopup(e.currentTarget.value, e.currentTarget.selectionStart)}
          onBlur={() => setPopup(null)}
          onPaste={onPaste}
          role="combobox"
          aria-expanded={popupOpen}
          aria-controls={popupOpen ? listId : undefined}
          aria-activedescendant={popupOpen ? `${listId}-${highlight}` : undefined}
          aria-autocomplete="list"
          aria-invalid={tooLong || undefined}
          className={cn(
            "block max-h-60 min-h-10 w-full resize-none bg-transparent px-3 py-2.5 text-14 leading-[22px] text-fg outline-none placeholder:text-fg-faint disabled:cursor-not-allowed",
            voiceOn && voice.recording && "hidden",
          )}
        />
        <div className="flex items-center gap-1 px-1.5 pb-1.5">
          {!isEdit && (
            <>
              <IconButton label="Attach files" size="sm" onClick={() => fileInput.current?.click()} disabled={disabled}>
                <Paperclip aria-hidden />
              </IconButton>
              <input
                ref={fileInput}
                type="file"
                multiple
                hidden
                accept={ACCEPT}
                onChange={(e) => {
                  addFiles([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              {recordLabel && (
                <RecordIconButton
                  label="Record screen"
                  className="size-7 [&_svg]:size-3.5"
                  target={{ kind: "chat", label: recordLabel, onFile: (f) => addFiles([f]) }}
                />
              )}
              <IconButton
                label="Mention someone"
                size="sm"
                disabled={disabled}
                onClick={() => {
                  const el = area.current;
                  if (!el) return;
                  const caret = el.selectionStart ?? text.length;
                  const needsSpace = caret > 0 && !/\s/.test(text[caret - 1]);
                  const next = `${text.slice(0, caret)}${needsSpace ? " " : ""}@${text.slice(caret)}`;
                  setText(next);
                  const pos = caret + (needsSpace ? 2 : 1);
                  requestAnimationFrame(() => {
                    el.focus();
                    el.setSelectionRange(pos, pos);
                    syncPopup(next, pos);
                  });
                }}
              >
                <AtSign aria-hidden />
              </IconButton>
            </>
          )}
          <span className="min-w-0 flex-1" />
          {remaining < 200 && (
            <span className={cn("px-1 text-11 tabular", remaining < 0 ? "font-medium text-danger-text" : "text-fg-faint")} aria-live="polite">
              {remaining < 0 ? `${-remaining} over the limit` : `${remaining} left`}
            </span>
          )}
          {isEdit ? (
            <>
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" variant="primary" onClick={submit} disabled={!canSend}>
                Save
              </Button>
            </>
          ) : voiceOn && !voice.active && trimmed.length === 0 && uploads.length === 0 ? (
            voice.micButton
          ) : (
            <button
              type="button"
              onClick={submit}
              aria-label="Send message"
              aria-disabled={!canSend}
              className={cn(
                "inline-flex size-7 items-center justify-center rounded-sm transition-colors duration-[var(--dur-fast)]",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                canSend ? "bg-accent text-fg-on-accent hover:bg-accent-hover" : "bg-active text-fg-faint",
              )}
            >
              <ArrowUp className="size-4" strokeWidth={2.25} aria-hidden />
            </button>
          )}
        </div>
      </div>
      {!isEdit && (
        <p className="mt-1 hidden px-1 text-11 text-fg-faint sm:block" aria-hidden>
          <span className="font-medium text-fg-muted">Enter</span> to send, <span className="font-medium text-fg-muted">Shift + Enter</span> for a new line
        </p>
      )}
      {isEdit && (
        <p className="mt-1 px-1 text-11 text-fg-faint" aria-hidden>
          <span className="font-medium text-fg-muted">Enter</span> to save, <span className="font-medium text-fg-muted">Esc</span> to cancel
        </p>
      )}
    </div>
  );
});

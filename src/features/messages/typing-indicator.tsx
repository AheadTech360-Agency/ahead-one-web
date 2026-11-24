"use client";

import { useEffect, useState } from "react";
import { firstName } from "./format";
import { useTypingEntries } from "./stores";

/** First names of people typing in a conversation right now; entries lapse after 5 s. */
export function useTypers(conversationId: string) {
  const entries = useTypingEntries(conversationId);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const list = Object.values(entries);
    if (list.length === 0) return;
    const soonest = Math.min(...list.map((e) => e.until));
    const t = setTimeout(() => setNow(Date.now()), Math.max(50, soonest - Date.now() + 20));
    return () => clearTimeout(t);
  }, [entries, now]);

  return Object.values(entries)
    .filter((e) => e.until > now)
    .map((e) => firstName(e.user));
}

/** "Maya is typing…" for 5 s after each typing event. Keeps its height so the composer never jumps. */
export function TypingIndicator({ conversationId }: { conversationId: string }) {
  const names = useTypers(conversationId);

  const text =
    names.length === 0
      ? ""
      : names.length === 1
        ? `${names[0]} is typing`
        : names.length === 2
          ? `${names[0]} and ${names[1]} are typing`
          : "Several people are typing";

  return (
    <div className="flex h-5 items-center gap-1.5 px-1 text-11 text-fg-muted" aria-live="polite">
      {text && (
        <>
          <span className="flex items-center gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="size-1 rounded-full bg-fg-faint motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
          <span>{text}…</span>
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

/*
 * Motion primitives for the sidebar. CSS does the animating (see "Sidebar motion" in globals.css);
 * these only decide what is mounted and which state attribute is set. No height is measured.
 */

/**
 * Height-animated disclosure. Children stay mounted while the 1fr to 0fr track runs, then unmount,
 * so a collapsed branch costs nothing. A branch that is open at first render appears without
 * animating; one opened later grows from zero.
 */
export function Collapse({ open, children, id }: { open: boolean; children: React.ReactNode; id?: string }) {
  const [mounted, setMounted] = useState(open);
  const [grow, setGrow] = useState(false);
  if (open && !mounted) {
    setMounted(true);
    setGrow(true);
  }
  useEffect(() => {
    if (open || !mounted) return;
    // transitionend is the normal path; this guards a tab that never ran the transition.
    const t = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  if (!open && !mounted) return null;
  return (
    <div
      id={id}
      className="sb-collapse"
      data-open={open}
      data-grow={grow}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget && e.propertyName === "grid-template-rows") setMounted(false);
      }}
    >
      <div className="sb-collapse-inner" inert={!open}>
        {children}
      </div>
    </div>
  );
}

export type Leaving<T> = { item: T; leaving: boolean };

/**
 * Keeps items that just disappeared from `items` for one exit animation, flagged `leaving`.
 * `items` must keep its identity between renders when nothing changed (query data does).
 */
export function useLeaving<T extends { id: string }>(items: readonly T[]): Leaving<T>[] {
  const [prev, setPrev] = useState(items);
  const [ghosts, setGhosts] = useState<{ item: T; index: number }[]>([]);
  if (prev !== items) {
    setPrev(items);
    const ids = new Set(items.map((i) => i.id));
    const gone = prev
      .map((item, index) => ({ item, index }))
      .filter((g) => !ids.has(g.item.id) && !ghosts.some((x) => x.item.id === g.item.id));
    if (gone.length > 0 || ghosts.some((g) => ids.has(g.item.id))) {
      setGhosts((cur) => [...cur.filter((g) => !ids.has(g.item.id)), ...gone]);
    }
  }
  useEffect(() => {
    if (ghosts.length === 0) return;
    const t = window.setTimeout(() => setGhosts([]), 260);
    return () => window.clearTimeout(t);
  }, [ghosts]);

  const out: Leaving<T>[] = items.map((item) => ({ item, leaving: false }));
  for (const g of [...ghosts].sort((a, b) => a.index - b.index)) {
    out.splice(Math.min(g.index, out.length), 0, { item: g.item, leaving: true });
  }
  return out;
}

const REVEAL_KEY = "ahead-one.sidebar-revealed";

function revealPending(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return !window.sessionStorage.getItem(REVEAL_KEY);
  } catch {
    return false;
  }
}

/**
 * First-load stagger, once per browser session. True from mount until 400ms after `ready` (data on
 * screen), so the attribute is gone before anything later is inserted. Lists that mount while the
 * session flag is still unset (the first 600ms) share the same reveal.
 */
export function useRevealOnce(ready: boolean): boolean {
  const [pending] = useState(revealPending);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!pending || !ready) return;
    const t = window.setTimeout(() => setDone(true), 400);
    const flag = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(REVEAL_KEY, "1");
      } catch {
        // Storage blocked: the stagger may replay on reload, which is harmless.
      }
    }, 600);
    return () => {
      window.clearTimeout(t);
      window.clearTimeout(flag);
    };
  }, [pending, ready]);
  return pending && ready && !done;
}

/** Marks a list as live once its first data is on screen, so only later inserts animate. */
export function useSettled(ready: boolean): boolean {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    if (!ready) return;
    const id = window.requestAnimationFrame(() => setSettled(true));
    return () => window.cancelAnimationFrame(id);
  }, [ready]);
  return settled;
}

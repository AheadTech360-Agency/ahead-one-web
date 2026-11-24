"use client";

import { useRef } from "react";
import { clampSidebar, SIDEBAR_MAX, SIDEBAR_MIN, useShell } from "./shell-context";

const STEP = 16;
const STEP_LARGE = 64;

/**
 * Window splitter on the sidebar's right edge (WAI-ARIA separator). Dragging writes the
 * --sb-w custom property straight to the frame, so React does not re-render per pointer move;
 * the value is committed (and persisted) on release. Arrow keys adjust, Home/End jump to the
 * limits, double-click restores the default.
 */
export function SidebarResizer({ frameRef }: { frameRef: React.RefObject<HTMLDivElement | null> }) {
  const { sidebarWidth, setSidebarWidth, resetSidebarWidth } = useShell();
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const live = useRef(sidebarWidth);

  function preview(w: number) {
    const c = clampSidebar(w);
    live.current = c;
    frameRef.current?.style.setProperty("--sb-w", `${c}px`);
    ref.current?.setAttribute("aria-valuenow", String(c));
    return c;
  }

  function end(e: React.PointerEvent) {
    if (!dragging.current) return;
    dragging.current = false;
    delete frameRef.current?.dataset.resizing;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setSidebarWidth(live.current);
  }

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuemin={SIDEBAR_MIN}
      aria-valuemax={SIDEBAR_MAX}
      aria-valuenow={sidebarWidth}
      tabIndex={0}
      className="sb-resizer"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        dragging.current = true;
        live.current = sidebarWidth;
        if (frameRef.current) frameRef.current.dataset.resizing = "true";
      }}
      onPointerMove={(e) => {
        if (!dragging.current || !frameRef.current) return;
        preview(e.clientX - frameRef.current.getBoundingClientRect().left);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={() => resetSidebarWidth()}
      onKeyDown={(e) => {
        const step = e.shiftKey ? STEP_LARGE : STEP;
        let next: number | null = null;
        if (e.key === "ArrowLeft") next = sidebarWidth - step;
        else if (e.key === "ArrowRight") next = sidebarWidth + step;
        else if (e.key === "Home") next = SIDEBAR_MIN;
        else if (e.key === "End") next = SIDEBAR_MAX;
        else if (e.key === "Enter") {
          resetSidebarWidth();
          e.preventDefault();
          return;
        }
        if (next === null) return;
        e.preventDefault();
        setSidebarWidth(next);
      }}
    />
  );
}

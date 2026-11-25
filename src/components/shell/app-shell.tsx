"use client";

import { useEffect, useRef, useState } from "react";
import { isApiConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { RecorderProvider } from "@/features/recorder/provider";
import { WorkspaceProvider } from "@/lib/workspace";
import { Sheet, SheetContent } from "@/ui/sheet";
import { AuthGate } from "./auth-gate";
import { CommandPalette } from "./command-palette";
import { CreateTaskDialog } from "./create-task-dialog";
import { ShellProvider, useShell } from "./shell-context";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SidebarContent } from "./sidebar";
import { SidebarResizer } from "./sidebar-resizer";
import { Topbar } from "./topbar";

function Frame({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, sidebarWidth, mobileNavOpen, setMobileNavOpen } = useShell();
  const frameRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Transitions stay off until the stored collapsed state and width have been applied, so
  // nothing animates on first paint.
  useEffect(() => {
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
  }, []);

  // The drawer is for narrow screens only; release the scroll lock if the window grows past it.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => mq.matches && setMobileNavOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setMobileNavOpen]);

  const swipe = useDrawerSwipe(() => setMobileNavOpen(false));
  // The drawer has no Radix trigger, so remember what opened it and give focus back on close.
  const opener = useRef<HTMLElement | null>(null);

  return (
    <div
      ref={frameRef}
      className="sb-frame flex h-dvh overflow-hidden bg-bg md:grid-rows-[minmax(0,1fr)]"
      data-rail={sidebarCollapsed}
      data-ready={ready}
      style={{ "--sb-w": `${sidebarWidth}px` } as React.CSSProperties}
    >
      <a
        href="#main"
        className="sr-only z-[var(--z-tooltip)] rounded-sm bg-surface px-3 py-2 text-13 font-medium text-fg shadow-popover focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside aria-label="Sidebar" className="relative hidden min-w-0 overflow-clip md:block">
        <SidebarContent />
        {!sidebarCollapsed && <SidebarResizer frameRef={frameRef} />}
      </aside>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent
          side="left"
          title="Navigation"
          hideHeader
          className="touch-pan-y bg-bg md:hidden"
          onOpenAutoFocus={() => {
            opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            opener.current?.focus();
          }}
          {...swipe}
        >
          <SidebarContent variant="drawer" onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main
          id="main"
          tabIndex={-1}
          className={cn(
            "relative min-h-0 flex-1 overflow-y-auto bg-surface outline-none",
            "border-t border-border md:mb-2 md:mr-2 md:rounded-lg md:border",
          )}
        >
          {!isApiConfigured && process.env.NODE_ENV !== "production" && (
            <p className="border-b border-border-subtle bg-warning-subtle px-4 py-2 text-12 text-warning-text">
              Local setup: the API address isn&apos;t set. Copy web/.env.example to web/.env.local and
              restart the dev server.
            </p>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

/** Swipe left on the open drawer to close it. The panel follows the finger, then either leaves or snaps back. */
function useDrawerSwipe(close: () => void) {
  const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
  const dx = useRef(0);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  const reset = (el: HTMLElement, animate: boolean) => {
    el.style.transition = animate ? "transform var(--dur-base) var(--ease-out-expo)" : "";
    el.style.transform = "";
  };

  return {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (e.pointerType === "mouse") return;
      start.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
      dx.current = 0;
    },
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const x = e.clientX - s.x;
      if (Math.abs(e.clientY - s.y) > Math.abs(x) && dx.current === 0) return;
      dx.current = Math.min(0, x);
      if (dx.current < -8) {
        e.currentTarget.style.transition = "none";
        e.currentTarget.style.transform = `translateX(${dx.current}px)`;
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLElement>) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const fast = -dx.current / Math.max(1, e.timeStamp - s.t) > 0.5;
      if (dx.current < -72 || (fast && dx.current < -24)) closeRef.current();
      else reset(e.currentTarget, true);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLElement>) => {
      start.current = null;
      reset(e.currentTarget, true);
    },
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ShellProvider>
        <RecorderProvider>
          <AuthGate />
          <Frame>{children}</Frame>
          <CommandPalette />
          <ShortcutsDialog />
          <CreateTaskDialog />
        </RecorderProvider>
      </ShellProvider>
    </WorkspaceProvider>
  );
}

"use client";

import { isApiConfigured } from "@/lib/env";
import { cn } from "@/lib/utils";
import { WorkspaceProvider } from "@/lib/workspace";
import { Sheet, SheetContent } from "@/ui/sheet";
import { AuthGate } from "./auth-gate";
import { CommandPalette } from "./command-palette";
import { CreateTaskDialog } from "./create-task-dialog";
import { ShellProvider, useShell } from "./shell-context";
import { ShortcutsDialog } from "./shortcuts-dialog";
import { SidebarContent } from "./sidebar";
import { Topbar } from "./topbar";

function Frame({ children }: { children: React.ReactNode }) {
  const { sidebarCollapsed, mobileNavOpen, setMobileNavOpen } = useShell();
  return (
    <div className="flex h-dvh overflow-hidden bg-bg">
      <a
        href="#main"
        className="sr-only z-[var(--z-tooltip)] rounded-sm bg-surface px-3 py-2 text-13 font-medium text-fg shadow-popover focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <aside
        aria-label="Sidebar"
        className={cn(
          "hidden w-[var(--sidebar-w)] shrink-0 md:block",
          sidebarCollapsed && "md:hidden",
        )}
      >
        <SidebarContent />
      </aside>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" title="Navigation" hideHeader className="bg-bg md:hidden">
          <SidebarContent onNavigate={() => setMobileNavOpen(false)} />
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
            sidebarCollapsed && "md:ml-2",
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

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceProvider>
      <ShellProvider>
        <AuthGate />
        <Frame>{children}</Frame>
        <CommandPalette />
        <ShortcutsDialog />
        <CreateTaskDialog />
      </ShellProvider>
    </WorkspaceProvider>
  );
}

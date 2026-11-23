"use client";

import { Menu, PanelLeft, Plus, Search } from "lucide-react";
import { useSyncExternalStore } from "react";
import { isMac } from "@/lib/utils";
import { IconButton } from "@/ui/icon-button";
import { KbdCombo } from "@/ui/kbd";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationCenter } from "./notification-center";
import { useShell } from "./shell-context";
import { ThemeToggle } from "./theme-toggle";
import { UserMenu } from "./user-menu";

const noop = () => () => {};

export function Topbar() {
  const { sidebarCollapsed, toggleSidebar, setMobileNavOpen, openPalette, setCreateTaskOpen } = useShell();
  const mod = useSyncExternalStore(noop, () => (isMac() ? "⌘" : "Ctrl"), () => "Ctrl");

  return (
    <header className="flex h-[var(--topbar-h)] shrink-0 items-center gap-2 px-2 md:pl-1 md:pr-3">
      <IconButton label="Open navigation" className="md:hidden" onClick={() => setMobileNavOpen(true)}>
        <Menu aria-hidden />
      </IconButton>
      <IconButton
        label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        shortcut={["["]}
        className="hidden md:inline-flex"
        onClick={toggleSidebar}
        aria-expanded={!sidebarCollapsed}
      >
        <PanelLeft aria-hidden />
      </IconButton>
      <div className="min-w-0 flex-1">
        <Breadcrumbs />
      </div>

      <button
        type="button"
        onClick={() => openPalette("commands")}
        className="hidden h-8 w-64 items-center gap-2 rounded-sm border border-border bg-surface px-2.5 text-13 text-fg-faint hover:border-border-strong hover:text-fg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Search or jump to</span>
        <KbdCombo keys={[mod, "K"]} />
      </button>
      <IconButton label="Search" shortcut={[mod, "K"]} className="lg:hidden" onClick={() => openPalette("commands")}>
        <Search aria-hidden />
      </IconButton>

      <div className="flex items-center gap-0.5">
        <IconButton label="Create task" shortcut={["C"]} onClick={() => setCreateTaskOpen(true)}>
          <Plus aria-hidden />
        </IconButton>
        <NotificationCenter />
        <ThemeToggle />
      </div>
      <span aria-hidden className="mx-1 hidden h-5 w-px bg-border sm:block" />
      <UserMenu />
    </header>
  );
}

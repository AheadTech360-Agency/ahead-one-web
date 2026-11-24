"use client";

import { Bell, CheckSquare, Home, Settings, Keyboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUnreadCount } from "@/lib/api/hooks";
import { cn } from "@/lib/utils";
import { SidebarMessages } from "@/features/messages/sidebar-messages";
import { useShell } from "./shell-context";
import { SpacesTree } from "./spaces-tree";
import { WorkspaceSwitcher } from "./workspace-switcher";

function NavLink({
  href,
  icon: Icon,
  label,
  count,
  exact,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  label: string;
  count?: number;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-[30px] items-center gap-2.5 rounded-sm px-2 text-13",
        "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
        active ? "bg-active font-semibold text-accent-text" : "text-fg-muted hover:bg-hover hover:text-fg",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active ? "text-accent-text" : "text-fg-faint")} strokeWidth={1.75} aria-hidden />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="text-12 font-medium text-fg-muted tabular" aria-label={`${count} unread`}>
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

/** Sidebar body, shared by the desktop column and the mobile drawer. */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const unread = useUnreadCount();
  const { setShortcutsOpen } = useShell();
  return (
    <div className="flex h-full flex-col">
      <div className="px-2 pt-2">
        <WorkspaceSwitcher />
      </div>
      <nav aria-label="Primary" className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2">
        <div className="flex flex-col gap-px pt-2">
          <NavLink href="/" icon={Home} label="Home" exact onNavigate={onNavigate} />
          <NavLink href="/my-tasks" icon={CheckSquare} label="My tasks" onNavigate={onNavigate} />
          <NavLink
            href="/inbox"
            icon={Bell}
            label="Inbox"
            count={unread.data?.count}
            onNavigate={onNavigate}
          />
        </div>
        <div className="mt-5 flex flex-col gap-5">
          <SidebarMessages onNavigate={onNavigate} />
          <SpacesTree onNavigate={onNavigate} />
        </div>
      </nav>
      <div className="flex flex-col gap-px border-t border-border px-2 py-2">
        <NavLink href="/settings" icon={Settings} label="Settings" onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => setShortcutsOpen(true)}
          className="flex h-[30px] items-center gap-2.5 rounded-sm px-2 text-13 text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
        >
          <Keyboard className="size-4 text-fg-faint" strokeWidth={1.75} aria-hidden />
          <span className="flex-1 text-left">Keyboard shortcuts</span>
          <kbd className="font-sans text-12 text-fg-faint">?</kbd>
        </button>
      </div>
    </div>
  );
}

"use client";

import { Bell, CheckSquare, FolderOpen, Home, Settings, Keyboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { memo, useEffect, useRef } from "react";
import { useUnreadCount } from "@/lib/api/hooks";
import { intent, usePrefetchers } from "@/lib/api/prefetch";
import { useBump } from "@/lib/hooks/use-bump";
import { cn } from "@/lib/utils";
import { SidebarMessages } from "@/features/messages/sidebar-messages";
import { PrivateEntry } from "@/features/personal/private-entry";
import { Tooltip } from "@/ui/tooltip";
import { useShell } from "./shell-context";
import { sbLabel, sbRow, sbRowActive, sbRowIdle } from "./sidebar-styles";
import { SpacesTree } from "./spaces-tree";
import { WorkspaceSwitcher } from "./workspace-switcher";

const SpacesTreeMemo = memo(SpacesTree);
const SidebarMessagesMemo = memo(SidebarMessages);

function NavLink({
  href,
  icon: Icon,
  label,
  shortcut,
  count,
  exact,
  onNavigate,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean; strokeWidth?: number }>;
  label: string;
  shortcut?: string[];
  count?: number;
  exact?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { sidebarCollapsed } = useShell();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const bump = useBump(count);
  const pf = usePrefetchers();
  const warm = href === "/" ? pf.home : href === "/my-tasks" ? pf.myTasks : undefined;
  const hasCount = count !== undefined && count > 0;
  return (
    <Tooltip content={label} shortcut={shortcut} side="right" disabled={!sidebarCollapsed}>
      <Link
        href={href}
        onClick={onNavigate}
        {...(warm ? intent(warm) : {})}
        aria-current={active ? "page" : undefined}
        data-active={active}
        className={cn(sbRow, "gap-2.5 overflow-hidden px-2 font-medium", active ? sbRowActive : sbRowIdle)}
      >
        <span className="relative inline-flex shrink-0">
          <Icon className={cn("size-4 shrink-0", active ? "text-accent-text" : "text-fg-faint")} strokeWidth={1.75} aria-hidden />
          {hasCount && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-green opacity-0 ring-2 ring-bg transition-opacity duration-[var(--dur-fast)] group-data-[rail=true]/sb:opacity-100"
            />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate", sbLabel)}>{label}</span>
        {hasCount && (
          <span
            key={bump}
            className={cn("text-12 font-medium text-fg-muted tabular", sbLabel, bump > 0 && "animate-badge")}
            aria-label={`${count} unread`}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Link>
    </Tooltip>
  );
}

/** Top and bottom shadows appear only while the tree actually overflows in that direction. */
function useScrollShadows() {
  const wrap = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLElement>(null);
  useEffect(() => {
    const w = wrap.current;
    const el = scroller.current;
    if (!w || !el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const top = el.scrollTop > 1;
      const bottom = el.scrollHeight - el.clientHeight - el.scrollTop > 1;
      if (w.dataset.scrollTop !== String(top)) w.dataset.scrollTop = String(top);
      if (w.dataset.scrollBottom !== String(bottom)) w.dataset.scrollBottom = String(bottom);
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener("scroll", schedule, { passive: true });
    const ro = new ResizeObserver(schedule);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", schedule);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return { wrap, scroller };
}

/**
 * Sidebar body, shared by the desktop column and the mobile drawer. Collapsing to the rail never
 * reflows text: icons keep their x position, labels are nowrap and only fade, and rows genuinely
 * narrow with the column so hit targets stay inside the rail.
 */
export function SidebarContent({
  onNavigate,
  variant = "desktop",
}: {
  onNavigate?: () => void;
  variant?: "desktop" | "drawer";
}) {
  const unread = useUnreadCount();
  const { setShortcutsOpen, sidebarCollapsed } = useShell();
  const rail = sidebarCollapsed && variant === "desktop";
  const { wrap, scroller } = useScrollShadows();
  return (
    <div
      className="group/sb flex h-full min-w-0 flex-col"
      data-rail={rail}
    >
      <div className={cn("px-2 pt-2", variant === "desktop" && "mr-1")}>
        <WorkspaceSwitcher rail={rail} />
      </div>
      <div ref={wrap} className="relative flex min-h-0 flex-1 flex-col">
        <div className="sb-scroll-shadow" data-edge="top" aria-hidden />
        <nav
          ref={scroller}
          aria-label="Primary"
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-2",
            variant === "desktop" && "mr-1 overflow-x-hidden group-data-[rail=true]/sb:overflow-hidden",
          )}
        >
          <div className="flex flex-col gap-px pt-2">
            <NavLink href="/" icon={Home} label="Home" shortcut={["G", "H"]} exact onNavigate={onNavigate} />
            <NavLink href="/my-tasks" icon={CheckSquare} label="My tasks" shortcut={["G", "T"]} onNavigate={onNavigate} />
            <NavLink href="/files" icon={FolderOpen} label="Files" shortcut={["G", "F"]} onNavigate={onNavigate} />
            <NavLink
              href="/inbox"
              icon={Bell}
              label="Inbox"
              shortcut={["G", "I"]}
              count={unread.data?.count}
              onNavigate={onNavigate}
            />
          </div>
          {/* Sections fold away with the rail (height track + fade) and stay mounted, so scroll and tree state survive. */}
          {/* On desktop the sections keep at least the expanded width (less a 10px scrollbar) while the column animates, so 200 rows are not re-laid out every frame. */}
          <div
            className="sb-collapse"
            data-open={!rail}
            style={variant === "desktop" ? { minWidth: "calc(var(--sb-w) - 1.25rem - 10px)" } : undefined}
          >
            <div className="sb-collapse-inner" inert={rail}>
              <div className="mt-5 flex flex-col gap-5 group-data-[rail=true]/sb:whitespace-nowrap">
                <SidebarMessagesMemo onNavigate={onNavigate} />
                <div className="flex flex-col gap-1.5">
                  <PrivateEntry onNavigate={onNavigate} />
                  <SpacesTreeMemo onNavigate={onNavigate} />
                </div>
              </div>
            </div>
          </div>
        </nav>
        <div className="sb-scroll-shadow" data-edge="bottom" aria-hidden />
      </div>
      <div className={cn("flex flex-col gap-px border-t border-border px-2 py-2", variant === "desktop" && "pr-3")}>
        <NavLink href="/settings" icon={Settings} label="Settings" shortcut={["G", "S"]} onNavigate={onNavigate} />
        <Tooltip content="Keyboard shortcuts" shortcut={["?"]} side="right" disabled={!sidebarCollapsed}>
          <button
            type="button"
            onClick={() => setShortcutsOpen(true)}
            className={cn(sbRow, sbRowIdle, "w-full gap-2.5 overflow-hidden px-2")}
          >
            <Keyboard className="size-4 shrink-0 text-fg-faint" strokeWidth={1.75} aria-hidden />
            <span className={cn("flex-1 text-left", sbLabel)}>Keyboard shortcuts</span>
            <kbd className={cn("font-sans text-12 text-fg-faint", sbLabel)}>?</kbd>
          </button>
        </Tooltip>
      </div>
    </div>
  );
}

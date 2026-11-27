"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { canSeeAppRelease } from "@/lib/app-release/format";
import { roleAtLeast, useWorkspace } from "@/lib/workspace";

export function SettingsNav() {
  const pathname = usePathname();
  const { role, current } = useWorkspace();
  const isAdmin = roleAtLeast(role, "admin");

  const groups = [
    {
      title: "Account",
      items: [
        { href: "/settings", label: "Profile and preferences" },
        { href: "/settings/connected-apps", label: "Connected apps" },
        { href: "/settings/android-app", label: "Android app", hidden: !canSeeAppRelease(role) },
      ].filter((i) => !i.hidden),
    },
    {
      title: current?.workspace.name ?? "Workspace",
      items: [
        { href: "/settings/members", label: "Members", hidden: !isAdmin && role !== undefined },
        { href: "/settings/audit-log", label: "Audit log", hidden: !isAdmin && role !== undefined },
      ].filter((i) => !i.hidden),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <nav aria-label="Settings" className="mb-5 md:mb-0">
      <div className="flex gap-1 overflow-x-auto md:flex-col md:gap-5">
        {groups.map((g) => (
          <div key={g.title} className="flex shrink-0 gap-1 md:flex-col md:gap-px">
            <p className="hidden truncate px-2 pb-1 text-12 font-medium text-fg-muted md:block">{g.title}</p>
            {g.items.map((i) => {
              const active = pathname === i.href;
              return (
                <Link
                  key={i.href}
                  href={i.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 shrink-0 items-center rounded-sm px-2 text-13 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring",
                    active ? "bg-active font-semibold text-accent-text" : "text-fg-muted hover:bg-hover hover:text-fg",
                  )}
                >
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}

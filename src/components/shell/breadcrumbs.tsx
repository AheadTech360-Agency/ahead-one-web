"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTree } from "@/lib/api/hooks";
import type { TreeSpace } from "@/lib/api/types";
import { useWorkspace } from "@/lib/workspace";

type Crumb = { label: string; href?: string; color?: string };

const STATIC: Record<string, Crumb[]> = {
  "/": [{ label: "Home" }],
  "/my-tasks": [{ label: "My tasks" }],
  "/inbox": [{ label: "Inbox" }],
  "/files": [{ label: "Files" }],
  "/messages": [{ label: "Messages" }],
  "/settings": [{ label: "Settings" }],
  "/settings/members": [{ label: "Settings", href: "/settings" }, { label: "Members" }],
  "/settings/audit-log": [{ label: "Settings", href: "/settings" }, { label: "Audit log" }],
  "/settings/android-app": [{ label: "Settings", href: "/settings" }, { label: "Android app" }],
  "/dev/components": [{ label: "Component library" }],
};

function fromTree(tree: TreeSpace[] | undefined, kind: "p" | "l", id: string): Crumb[] {
  for (const s of tree ?? []) {
    for (const p of s.projects) {
      if (kind === "p" && p.id === id) {
        return [{ label: s.name, color: s.color }, { label: p.name, color: p.color }];
      }
      const l = p.lists.find((x) => x.id === id);
      if (kind === "l" && l) {
        return [
          { label: s.name, color: s.color },
          { label: p.name, href: `/p/${p.id}`, color: p.color },
          { label: l.name },
        ];
      }
    }
  }
  return [{ label: kind === "p" ? "Project" : "List" }];
}

export function useCrumbs(): Crumb[] {
  const pathname = usePathname();
  const { workspaceId } = useWorkspace();
  const tree = useTree(workspaceId);
  if (STATIC[pathname]) return STATIC[pathname];
  const [, seg, id] = pathname.split("/");
  if ((seg === "p" || seg === "l") && id) return fromTree(tree.data, seg, id);
  if (seg === "t") return [{ label: "Task" }];
  if (seg === "messages") return [{ label: "Messages", href: "/messages" }, { label: "Conversation" }];
  return [{ label: "AheadOne" }];
}

export function Breadcrumbs() {
  const crumbs = useCrumbs();
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1 text-13">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={`${c.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-fg-faint" aria-hidden />}
              {c.color && (
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              )}
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate rounded-xs text-fg-muted hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
                >
                  {c.label}
                </Link>
              ) : (
                <span
                  aria-current={last ? "page" : undefined}
                  className={last ? "truncate font-medium text-fg" : "truncate text-fg-muted"}
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

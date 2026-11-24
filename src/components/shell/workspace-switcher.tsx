"use client";

import { Check, ChevronsUpDown, Settings, Users } from "lucide-react";
import Link from "next/link";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL, roleAtLeast, useWorkspace } from "@/lib/workspace";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { BrandMark } from "@/ui/brand-mark";
import { Skeleton } from "@/ui/skeleton";
import { Tooltip } from "@/ui/tooltip";
import { sbLabel } from "./sidebar-styles";

function Mark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-xs bg-accent text-[11px] font-bold tracking-tight text-fg-on-accent",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

export function WorkspaceSwitcher({ rail = false }: { rail?: boolean }) {
  const { current, memberships, setWorkspaceId, meStatus, role } = useWorkspace();
  const name = current?.workspace.name ?? "AheadOne";

  if (meStatus === "pending") {
    return (
      <div className="flex h-10 items-center gap-2 px-1">
        <Skeleton shimmer className="size-6 rounded-sm" />
        <Skeleton shimmer className="h-3 w-28" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip content={name} side="right" disabled={!rail}>
        <DropdownMenuTrigger
          className={cn(
            "group flex h-10 w-full min-w-0 items-center gap-2 rounded-md px-1 text-left",
            "transition-colors duration-[var(--dur-fast)] hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring data-[state=open]:bg-active",
          )}
          aria-label={`Workspace: ${name}. Switch workspace`}
        >
          <BrandMark className="size-6" />
          <span className={cn("min-w-0 flex-1", sbLabel)}>
            <span className="block truncate font-display text-14 font-semibold tracking-[-0.01em] text-fg">{name}</span>
          </span>
          <ChevronsUpDown className={cn("size-3.5 shrink-0 text-fg-faint", sbLabel)} aria-hidden />
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent className="w-64" align="start">
        {memberships.length > 0 ? (
          <>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {memberships.map((m) => (
              <DropdownMenuItem key={m.workspace.id} onSelect={() => setWorkspaceId(m.workspace.id)}>
                <Mark name={m.workspace.name} className="size-5 text-[10px]" />
                <span className="min-w-0 flex-1 truncate">{m.workspace.name}</span>
                <span className="text-12 text-fg-faint">{ROLE_LABEL[m.role]}</span>
                {m.workspace.id === current?.workspace.id && (
                  <Check className="!text-accent" aria-label="Current workspace" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <DropdownMenuLabel>No workspace loaded yet</DropdownMenuLabel>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings aria-hidden /> Settings
          </Link>
        </DropdownMenuItem>
        {roleAtLeast(role, "admin") && (
          <DropdownMenuItem asChild>
            <Link href="/settings/members">
              <Users aria-hidden /> Members and invites
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

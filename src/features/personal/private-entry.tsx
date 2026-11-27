"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { sbLabel, sbRow, sbRowActive, sbRowIdle } from "@/components/shell/sidebar-styles";
import { cn } from "@/lib/utils";
import { toast } from "@/ui/toaster";
import { errorMessage } from "@/lib/api/client";
import { usePersonal } from "./api";
import { PERSONAL_NAME } from "./logic";

/**
 * "My private tasks" in the sidebar, above the clients. A link once the personal list is known;
 * before that a button that creates the project (idempotent) and then opens it. Never shown to Guests.
 */
export function PrivateEntry({ onNavigate }: { onNavigate?: () => void }) {
  const { enabled, info, open, ensuring, treePending } = usePersonal();
  const pathname = usePathname();
  if (!enabled) return null;
  const href = info ? `/l/${info.list.id}` : undefined;
  const active = Boolean(href) && pathname === href;
  const cls = cn(sbRow, "w-full gap-2.5 overflow-hidden px-2 font-medium", active ? sbRowActive : sbRowIdle);
  const icon = <Lock className={cn("size-4 shrink-0", active ? "text-accent-text" : "text-fg-faint")} strokeWidth={1.75} aria-hidden />;
  const label = <span className={cn("min-w-0 flex-1 truncate text-left", sbLabel)}>{PERSONAL_NAME}</span>;
  return (
    <div className="flex flex-col" data-testid="private-entry">
      {href ? (
        <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cls} title="Only you can see these tasks">
          {icon}
          {label}
        </Link>
      ) : (
        <button
          type="button"
          disabled={ensuring || treePending}
          aria-busy={ensuring}
          className={cls}
          title="Only you can see these tasks"
          onClick={() => {
            onNavigate?.();
            open().catch((e) => toast.error("Couldn't open your private tasks", { description: errorMessage(e) }));
          }}
        >
          {icon}
          {label}
        </button>
      )}
    </div>
  );
}

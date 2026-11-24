"use client";

import { Keyboard, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabase/client";
import { unregisterPushOnSignOut } from "@/features/push/push";
import { useWorkspace } from "@/lib/workspace";
import { Avatar } from "@/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/ui/menu";
import { toast } from "@/ui/toaster";
import { useShell } from "./shell-context";

export function useSignOut() {
  const router = useRouter();
  const qc = useQueryClient();
  return async () => {
    // Remove this browser's push token while the session can still authorise the request.
    await unregisterPushOnSignOut();
    try {
      await getSupabase().auth.signOut();
    } catch {
      toast.error("Couldn't reach the sign-in service. You've been signed out on this device.");
    }
    qc.clear();
    router.replace("/login");
    router.refresh();
  };
}

export function UserMenu() {
  const { me } = useWorkspace();
  const { theme, setTheme } = useTheme();
  const { setShortcutsOpen } = useShell();
  const signOut = useSignOut();
  const user = me?.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="inline-flex size-8 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {user ? (
          <Avatar user={user} size="sm" decorative className="size-7" />
        ) : (
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-active text-fg-muted">
            <UserRound className="size-4" aria-hidden />
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5 pb-2">
          <span className="truncate text-13 font-medium text-fg">{user?.full_name || "Your account"}</span>
          <span className="truncate text-12 text-fg-muted">{me?.user.email ?? "Profile not loaded"}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <UserRound aria-hidden /> Profile and settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun aria-hidden className="dark:hidden" />
            <Moon aria-hidden className="hidden dark:block" />
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">
                <Sun aria-hidden /> Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <Moon aria-hidden /> Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <Monitor aria-hidden /> System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => setShortcutsOpen(true)} shortcut="?">
          <Keyboard aria-hidden /> Keyboard shortcuts
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

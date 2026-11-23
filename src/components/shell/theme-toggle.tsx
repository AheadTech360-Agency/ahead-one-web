"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { IconButton } from "@/ui/icon-button";

const noop = () => () => {};

/** One-click switch between light and dark. "System" lives in the user menu and settings. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // The theme is only known in the browser; keep the server label neutral to avoid a mismatch.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const next = resolvedTheme === "dark" ? "light" : "dark";
  return (
    <IconButton
      label={hydrated ? `Switch to ${next} theme` : "Switch theme"}
      shortcut={["Shift", "T"]}
      onClick={() => setTheme(next)}
    >
      <Sun aria-hidden className="hidden dark:block" />
      <Moon aria-hidden className="dark:hidden" />
    </IconButton>
  );
}

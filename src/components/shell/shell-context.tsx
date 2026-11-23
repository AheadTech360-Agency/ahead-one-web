"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useStoredState } from "@/lib/hooks/use-stored-state";

export type PaletteMode = "commands" | "search";

type ShellState = {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileNavOpen: boolean;
  setMobileNavOpen: (open: boolean) => void;
  palette: { open: boolean; mode: PaletteMode };
  openPalette: (mode?: PaletteMode) => void;
  setPaletteOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  createTaskOpen: boolean;
  setCreateTaskOpen: (open: boolean) => void;
};

const Ctx = createContext<ShellState | null>(null);

export function useShell() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useShell must be used inside ShellProvider");
  return v;
}

/** Go-to sequences: press G, then the letter. */
export const GOTO: Record<string, { href: string; label: string }> = {
  h: { href: "/", label: "Home" },
  t: { href: "/my-tasks", label: "My tasks" },
  i: { href: "/inbox", label: "Inbox" },
  m: { href: "/messages", label: "Messages" },
  s: { href: "/settings", label: "Settings" },
};

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT" ||
    el.getAttribute("role") === "combobox"
  );
}

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [sidebarCollapsed, setSidebarCollapsed] = useStoredState("ahead-one.sidebar-collapsed", false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [palette, setPalette] = useState<{ open: boolean; mode: PaletteMode }>({
    open: false,
    mode: "commands",
  });
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const gotoArmed = useRef<number | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => ({ open: !p.open, mode: "commands" }));
        return;
      }
      if (mod || e.altKey || e.defaultPrevented || isTypingTarget(e.target)) return;
      // Leave single-key shortcuts alone while any overlay is open.
      if (document.querySelector('[role="dialog"], [role="menu"], [role="listbox"]')) return;

      if (gotoArmed.current !== null) {
        const dest = GOTO[e.key.toLowerCase()];
        window.clearTimeout(gotoArmed.current);
        gotoArmed.current = null;
        if (dest) {
          e.preventDefault();
          router.push(dest.href);
        }
        return;
      }

      switch (e.key) {
        case "?":
          e.preventDefault();
          setShortcutsOpen(true);
          break;
        case "/":
          e.preventDefault();
          setPalette({ open: true, mode: "search" });
          break;
        case "c":
        case "C":
          e.preventDefault();
          setCreateTaskOpen(true);
          break;
        case "[":
          e.preventDefault();
          setSidebarCollapsed((c) => !c);
          break;
        case "g":
        case "G":
          gotoArmed.current = window.setTimeout(() => (gotoArmed.current = null), 1200);
          break;
        case "T":
          if (e.shiftKey) {
            e.preventDefault();
            setTheme(resolvedTheme === "dark" ? "light" : "dark");
          }
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, resolvedTheme, setTheme, setSidebarCollapsed]);

  const value = useMemo<ShellState>(
    () => ({
      sidebarCollapsed,
      toggleSidebar: () => setSidebarCollapsed((c) => !c),
      mobileNavOpen,
      setMobileNavOpen,
      palette,
      openPalette: (mode = "commands") => setPalette({ open: true, mode }),
      setPaletteOpen: (open) => setPalette((p) => ({ ...p, open })),
      shortcutsOpen,
      setShortcutsOpen,
      createTaskOpen,
      setCreateTaskOpen,
    }),
    [sidebarCollapsed, setSidebarCollapsed, mobileNavOpen, palette, shortcutsOpen, createTaskOpen],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

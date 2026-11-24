"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { KbdCombo } from "./kbd";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={350} skipDelayDuration={200}>
    {children}
  </TooltipPrimitive.Provider>
);

export function Tooltip({
  content,
  shortcut,
  side = "bottom",
  align = "center",
  disabled,
  children,
}: {
  content: React.ReactNode;
  shortcut?: string[];
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  /** Keep the trigger mounted but never show the tip (for example when a label is already visible). */
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <TooltipPrimitive.Root open={open && !disabled} onOpenChange={setOpen}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-[var(--z-tooltip)] flex items-center gap-2 rounded-sm bg-fg px-2 py-1 text-12 font-medium text-surface",
            "origin-[var(--radix-tooltip-content-transform-origin)] shadow-popover data-[state=delayed-open]:animate-in-fade data-[state=closed]:animate-out-fade",
          )}
        >
          {content}
          {shortcut && (
            <KbdCombo
              keys={shortcut}
              className="[&_kbd]:border-transparent [&_kbd]:bg-white/15 [&_kbd]:text-surface dark:[&_kbd]:bg-black/15"
            />
          )}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

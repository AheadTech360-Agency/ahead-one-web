"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
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
  children,
}: {
  content: React.ReactNode;
  shortcut?: string[];
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            "z-[var(--z-tooltip)] flex items-center gap-2 rounded-sm bg-fg px-2 py-1 text-12 font-medium text-surface",
            "shadow-popover data-[state=delayed-open]:animate-in-fade",
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

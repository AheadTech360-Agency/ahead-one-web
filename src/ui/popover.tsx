"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverClose = PopoverPrimitive.Close;

export function PopoverContent({
  className,
  align = "start",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        collisionPadding={8}
        className={cn(
          "z-[var(--z-popover)] rounded-md border border-border bg-surface-raised text-fg shadow-popover outline-none",
          "origin-[var(--radix-popover-content-transform-origin)] data-[side=top]:[--pop-y:4px] data-[side=bottom]:[--pop-y:-4px] data-[side=left]:[--pop-x:4px] data-[side=right]:[--pop-x:-4px] data-[state=open]:animate-in-pop data-[state=closed]:animate-out-pop",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}

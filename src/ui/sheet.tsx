"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Slide-over panel (right) or navigation drawer (left). Same focus trap and restore as Dialog.
 */

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

export function SheetContent({
  side = "right",
  title,
  description,
  hideHeader,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  side?: "left" | "right";
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Visually hide the header (title still announced). */
  hideHeader?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-overlay data-[state=open]:animate-in-fade" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-0 z-[var(--z-modal)] flex flex-col bg-surface-raised text-fg shadow-dialog outline-none",
          side === "right"
            ? "right-0 w-[min(480px,100vw)] border-l border-border data-[state=open]:animate-in-sheet"
            : "left-0 w-[min(300px,86vw)] border-r border-border data-[state=open]:animate-in-drawer",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "flex h-12 shrink-0 items-center gap-3 border-b border-border-subtle px-4",
            hideHeader && "sr-only",
          )}
        >
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="truncate text-14 font-semibold">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="truncate text-12 text-fg-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close panel"
            className="inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

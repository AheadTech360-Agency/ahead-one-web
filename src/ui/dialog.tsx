"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/*
 * Modal dialog. Radix traps focus inside, closes on Escape, and returns focus to the
 * trigger on close. Use for tasks that need protected focus (invite, confirm, create).
 */

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  size = "md",
  hideClose,
  ...props
}: Omit<React.ComponentProps<typeof DialogPrimitive.Content>, "title"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-overlay data-[state=open]:animate-in-fade" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-[12vh] z-[var(--z-modal)] w-[calc(100vw-32px)] -translate-x-1/2",
          "flex max-h-[76vh] flex-col rounded-lg border border-border bg-surface-raised text-fg shadow-dialog outline-none",
          "data-[state=open]:animate-in-pop",
          size === "sm" && "max-w-[400px]",
          size === "md" && "max-w-[520px]",
          size === "lg" && "max-w-[720px]",
          className,
        )}
        {...props}
      >
        <div className="flex items-start gap-3 px-5 pb-1 pt-4">
          <div className="min-w-0 flex-1">
            <DialogPrimitive.Title className="text-16 font-semibold text-fg">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-13 text-fg-muted">
                {description}
              </DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          {!hideClose && (
            <DialogPrimitive.Close
              aria-label="Close"
              className="-mr-1.5 -mt-0.5 inline-flex size-7 items-center justify-center rounded-sm text-fg-muted hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          )}
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center justify-end gap-2 border-t border-border-subtle px-5 py-3", className)}
      {...props}
    />
  );
}

/**
 * Confirmation for destructive actions. The confirm button names the action and the object
 * ("Archive Q3 Launch"), never "OK".
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  loading,
  tone = "danger",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  loading?: boolean;
  tone?: "danger" | "primary";
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title} description={description} size="sm" hideClose>
        <DialogFooter className="mt-3">
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant={tone} loading={loading} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

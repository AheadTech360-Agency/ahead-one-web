"use client";

import { Dialog as DialogPrimitive } from "radix-ui";
import dynamic from "next/dynamic";
import { useRef } from "react";
import { DetailSkeleton } from "@/components/skeletons";
import { cn } from "@/lib/utils";
import { useTaskLink } from "../lib/use-task-filters";

// The task screen (comments, attachments, subtasks, activity) loads when the first task opens.
const TaskDetail = dynamic(() => import("./task-detail").then((m) => m.TaskDetail), {
  ssr: false,
  loading: () => <DetailSkeleton label="Loading task" />,
});

/**
 * URL-driven task panel: any screen that mounts this opens the task in `?task=<id>`, so the
 * link can be shared and the back button closes it. Related tasks open in the same panel.
 */
export function TaskSlideOver() {
  const link = useTaskLink();
  const id = link.current;
  const panel = useRef<HTMLDivElement>(null);
  return (
    <DialogPrimitive.Root open={Boolean(id)} onOpenChange={(o) => !o && link.close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[var(--z-overlay)] bg-[color-mix(in_srgb,var(--overlay)_55%,transparent)] data-[state=open]:animate-in-fade" />
        <DialogPrimitive.Content
          ref={panel}
          aria-describedby={undefined}
          // Land on the panel itself, not its first button, so no tooltip pops on open.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            panel.current?.focus();
          }}
          tabIndex={-1}
          className={cn(
            "fixed inset-y-0 right-0 z-[var(--z-modal)] flex w-[min(760px,100vw)] flex-col border-l border-border bg-surface-raised text-fg shadow-dialog outline-none",
            "data-[state=open]:animate-in-sheet md:inset-y-2 md:right-2 md:rounded-lg md:border",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Task details</DialogPrimitive.Title>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {id && <TaskDetail key={id} taskId={id} layout="panel" hrefFor={link.href} onClose={link.close} onDeleted={link.close} />}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

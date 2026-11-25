"use client";

import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/ui/button";
import { IconButton } from "@/ui/icon-button";
import { toast } from "@/ui/toaster";
import { useRecorder, type RecorderTarget } from "./provider";

/*
 * Entry points share this. When the browser can't record (phones, old browsers) the control stays
 * visible but aria-disabled, and activating it says why, so nobody wonders where the feature went.
 */

function useRecordAction(target?: RecorderTarget) {
  const rec = useRecorder();
  const unavailable = rec.support.ok === false ? rec.support.reason : null;
  return {
    unavailable,
    busy: rec.busy,
    run: () => {
      if (unavailable) toast("Screen recording isn't available here", { description: unavailable });
      else rec.open(target);
    },
  };
}

export function RecordIconButton({ target, className, label = "Record screen" }: { target?: RecorderTarget; className?: string; label?: string }) {
  const a = useRecordAction(target);
  return (
    <IconButton
      label={a.unavailable ? `${label} (not available on this device)` : label}
      className={className}
      aria-disabled={a.unavailable ? true : undefined}
      disabled={a.busy}
      onClick={a.run}
      data-testid="record-screen"
    >
      <Video aria-hidden />
    </IconButton>
  );
}

export function RecordButton({
  target,
  size = "sm",
  variant = "secondary",
  className,
  children = "Record screen",
}: {
  target?: RecorderTarget;
  size?: "sm" | "md";
  variant?: "secondary" | "ghost";
  className?: string;
  children?: React.ReactNode;
}) {
  const a = useRecordAction(target);
  return (
    <Button
      size={size}
      variant={variant}
      className={cn(className)}
      aria-disabled={a.unavailable ? true : undefined}
      disabled={a.busy}
      title={a.unavailable ?? undefined}
      onClick={a.run}
      data-testid="record-screen"
    >
      <Video aria-hidden /> {children}
    </Button>
  );
}

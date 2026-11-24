"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

export { toast };

/** App-wide toasts. Bottom right, themed from tokens, announced politely by sonner. */
export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position="bottom-right"
      gap={8}
      visibleToasts={4}
      closeButton
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "group pointer-events-auto flex w-[356px] max-w-[calc(100vw-32px)] items-start gap-2.5 rounded-md border border-border bg-surface-raised p-3 pr-8 text-13 text-fg shadow-popover",
          title: "font-medium text-fg",
          description: "text-12 text-fg-muted mt-0.5",
          icon: "mt-0.5 flex size-4 shrink-0 items-center [&_svg]:size-4",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-info",
          actionButton:
            "ml-auto h-7 shrink-0 rounded-none bg-accent px-2.5 text-12 font-semibold text-fg-on-accent hover:bg-accent-hover",
          cancelButton: "ml-auto h-7 shrink-0 rounded-sm px-2.5 text-12 text-fg-muted hover:bg-hover",
          closeButton:
            "!absolute !right-1.5 !top-1.5 !left-auto !size-6 !transform-none rounded-sm !border-0 !bg-transparent text-fg-faint hover:!bg-hover hover:text-fg",
        },
      }}
      style={{ zIndex: "var(--z-toast)" } as React.CSSProperties}
    />
  );
}

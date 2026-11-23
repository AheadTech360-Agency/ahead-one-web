import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium " +
  "transition-[background-color,border-color,color,box-shadow] duration-[var(--dur-fast)] ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
  "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-fg-on-accent hover:bg-accent-hover active:bg-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-fg hover:bg-surface-sunken hover:border-border-strong active:bg-active",
  ghost: "text-fg-muted hover:bg-hover hover:text-fg active:bg-active",
  danger: "bg-danger text-fg-on-danger hover:bg-danger-hover active:bg-danger-hover",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-12 [&_svg]:size-3.5",
  md: "h-8 px-3 text-13 [&_svg]:size-4",
  lg: "h-9 px-4 text-14 [&_svg]:size-4",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
};

export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, asChild, className, children, disabled, type, ...props },
  ref,
) {
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={buttonClasses({ variant, size, className })} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      ref={ref}
      type={type ?? "button"}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <span className="invisible inline-flex items-center gap-1.5">{children}</span>
          <span className="absolute inset-0 inline-flex items-center justify-center">
            <Spinner size={14} label="Working" />
          </span>
        </>
      ) : (
        children
      )}
    </button>
  );
});

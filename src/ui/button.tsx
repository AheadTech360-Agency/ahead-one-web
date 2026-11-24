import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "text";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-xs font-semibold " +
  "transition-[background-color,border-color,color,box-shadow,translate,text-decoration-color] duration-[var(--dur-fast)] ease-out " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring " +
  "disabled:cursor-not-allowed disabled:opacity-55 aria-disabled:cursor-not-allowed aria-disabled:opacity-55 " +
  "[&_svg]:shrink-0";

/*
 * Primary is the brand button: a square navy block with a 2px border that lifts up-left on hover
 * and casts a hard green offset shadow, then settles back when pressed. Reduced motion keeps the
 * shadow and drops the travel. The label is set bold, uppercase and tracked at md and lg (page
 * actions, form submits); sm primaries sit inline in composers and editors, where capitals would
 * shout over the text being written, so they stay sentence case (see `sizes`).
 */
const variants: Record<ButtonVariant, string> = {
  primary:
    "rounded-none border-2 border-accent bg-accent text-fg-on-accent font-bold " +
    "not-disabled:hover:shadow-lift motion-safe:not-disabled:hover:-translate-x-0.5 motion-safe:not-disabled:hover:-translate-y-0.5 " +
    "not-disabled:active:shadow-press motion-safe:not-disabled:active:translate-x-0 motion-safe:not-disabled:active:translate-y-0 " +
    "not-disabled:active:bg-accent-hover not-disabled:active:border-accent-hover " +
    /* Disabled keeps a readable label on a quiet tint instead of a faded navy block. */
    "disabled:opacity-100 disabled:border-border-strong disabled:bg-active disabled:text-fg-muted",
  secondary:
    "border border-border-strong bg-surface text-fg hover:bg-surface-sunken hover:border-border-strong active:bg-active",
  ghost: "text-fg-muted hover:bg-hover hover:text-fg active:bg-active",
  danger: "rounded-none border-2 border-danger bg-danger text-fg-on-danger hover:bg-danger-hover hover:border-danger-hover active:bg-danger-hover",
  /* Brand text button: ink label on a 2px ink underline that turns green on hover. */
  text:
    "!h-auto !px-0 rounded-none text-fg underline decoration-fg decoration-2 underline-offset-[5px] hover:decoration-green",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-12 [&_svg]:size-3.5",
  md: "h-8 px-3 text-13 [&_svg]:size-4",
  lg: "h-10 px-4 text-14 [&_svg]:size-4",
};

/* The tracked capitals of the brand label, on primaries at md and lg only. */
const primaryCase: Record<ButtonSize, string> = {
  sm: "",
  md: "uppercase text-12 tracking-[0.6px]",
  lg: "uppercase text-13 tracking-[0.6px]",
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
  return cn(base, variants[variant], sizes[size], variant === "primary" && primaryCase[size], className);
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

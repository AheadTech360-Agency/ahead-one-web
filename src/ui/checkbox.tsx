"use client";

import { Checkbox as CheckboxPrimitive, Switch as SwitchPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";

type CheckboxProps = React.ComponentProps<typeof CheckboxPrimitive.Root> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
};

export function Checkbox({ className, label, description, id: idProp, ...props }: CheckboxProps) {
  const auto = useId();
  const id = idProp ?? `cb${auto}`;
  const box = (
    <CheckboxPrimitive.Root
      id={id}
      className={cn(
        "peer inline-flex size-4 shrink-0 items-center justify-center rounded-xs border border-border-strong bg-surface",
        "transition-colors duration-[var(--dur-fast)] ease-out hover:border-fg-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-fg-on-accent",
        "data-[state=indeterminate]:border-accent data-[state=indeterminate]:bg-accent data-[state=indeterminate]:text-fg-on-accent",
        "disabled:cursor-not-allowed disabled:opacity-50",
        !label && className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator>
        {props.checked === "indeterminate" ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
  if (!label) return box;
  return (
    <div className={cn("flex items-start gap-2", className)}>
      <span className="flex h-5 items-center">{box}</span>
      <label htmlFor={id} className="flex flex-col text-13 text-fg select-none">
        {label}
        {description && <span className="text-12 text-fg-muted">{description}</span>}
      </label>
    </div>
  );
}

type SwitchProps = React.ComponentProps<typeof SwitchPrimitive.Root> & {
  label?: React.ReactNode;
  description?: React.ReactNode;
};

export function Switch({ className, label, description, id: idProp, ...props }: SwitchProps) {
  const auto = useId();
  const id = idProp ?? `sw${auto}`;
  const control = (
    <SwitchPrimitive.Root
      id={id}
      className={cn(
        "inline-flex h-[18px] w-8 shrink-0 items-center rounded-full border border-transparent bg-border-strong p-0.5",
        "transition-colors duration-[var(--dur-base)] ease-out",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "data-[state=checked]:bg-accent disabled:cursor-not-allowed disabled:opacity-50",
        !label && className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "block size-3.5 rounded-full bg-white shadow-xs transition-transform duration-[var(--dur-base)] ease-out",
          "data-[state=checked]:translate-x-3.5",
        )}
      />
    </SwitchPrimitive.Root>
  );
  if (!label) return control;
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <label htmlFor={id} className="flex flex-col text-13 font-medium text-fg select-none">
        {label}
        {description && <span className="font-normal text-12 text-fg-muted">{description}</span>}
      </label>
      <span className="flex h-5 items-center">{control}</span>
    </div>
  );
}

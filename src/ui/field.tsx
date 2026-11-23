"use client";

import { Label as LabelPrimitive } from "radix-ui";
import { createContext, useContext, useId } from "react";
import { cn } from "@/lib/utils";

type FieldCtx = { id: string; describedBy?: string; invalid: boolean };
const FieldContext = createContext<FieldCtx | null>(null);

/** Inputs call this to pick up the id, aria-describedby and aria-invalid of their Field. */
export function useFieldControl(props: {
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: React.AriaAttributes["aria-invalid"];
}) {
  const ctx = useContext(FieldContext);
  return {
    id: props.id ?? ctx?.id,
    "aria-describedby":
      [props["aria-describedby"], ctx?.describedBy].filter(Boolean).join(" ") || undefined,
    "aria-invalid": props["aria-invalid"] ?? (ctx?.invalid ? true : undefined),
  };
}

export function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn("text-13 font-medium text-fg select-none", className)}
      {...props}
    />
  );
}

/**
 * A labelled form control with optional hint and error text.
 * The label is always visible; the error replaces nothing and is announced politely.
 */
export function Field({
  label,
  hint,
  error,
  optional,
  className,
  children,
  id: idProp,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  optional?: boolean;
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  const auto = useId();
  const id = idProp ?? `f${auto}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Label htmlFor={id}>
          {label}
          {optional && <span className="ml-1 font-normal text-fg-faint">(optional)</span>}
        </Label>
        {children}
        {hint && !error && (
          <p id={hintId} className="text-12 text-fg-muted">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-12 text-danger-text">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

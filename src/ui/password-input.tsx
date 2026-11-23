"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { Input } from "./input";

type Props = Omit<React.ComponentProps<typeof Input>, "type" | "trailing">;

/** Password field with a show/hide toggle that keeps focus in the field. */
export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="inline-flex size-6 items-center justify-center rounded-xs text-fg-faint hover:text-fg focus-visible:outline-2 focus-visible:outline-ring"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      }
    />
  );
});

/** Six-digit one-time code field (TOTP). Calls onComplete once six digits are entered. */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <Input
      size="lg"
      autoFocus={autoFocus}
      disabled={disabled}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={6}
      value={value}
      placeholder="000000"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
        onChange(digits);
        if (digits.length === 6) onComplete?.(digits);
      }}
      className="text-center font-mono text-20 tracking-[0.5em] tabular"
    />
  );
}

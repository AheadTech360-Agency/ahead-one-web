"use client";

import { Field } from "@/ui/field";
import { PasswordInput } from "@/ui/password-input";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

export function validateNewPassword(password: string, confirm: string) {
  const errors: { password?: string; confirm?: string } = {};
  if (password.length < PASSWORD_MIN) errors.password = `Use at least ${PASSWORD_MIN} characters.`;
  else if (password.length > PASSWORD_MAX) errors.password = `Use ${PASSWORD_MAX} characters or fewer.`;
  if (!errors.password && confirm !== password) errors.confirm = "The two passwords don't match.";
  return errors;
}

type Strength = { level: 0 | 1 | 2 | 3; label: string };

/** A length-first hint, not a policy: the API only enforces 12 to 128 characters. */
export function passwordStrength(pw: string): Strength {
  if (pw.length < PASSWORD_MIN) return { level: 0, label: pw ? `${PASSWORD_MIN - pw.length} more to go` : "" };
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  const score = (pw.length >= 16 ? 1 : 0) + (pw.length >= 22 ? 1 : 0) + (kinds >= 3 ? 1 : 0);
  if (score >= 2) return { level: 3, label: "Strong" };
  if (score === 1) return { level: 2, label: "Good" };
  return { level: 1, label: "Okay. Longer is stronger" };
}

function StrengthHint({ password }: { password: string }) {
  const { level, label } = passwordStrength(password);
  if (!password) return null;
  const color = level === 0 ? "bg-danger" : level === 1 ? "bg-warning" : "bg-green";
  return (
    <div className="-mt-2 flex items-center gap-2" aria-hidden={false}>
      <span aria-hidden className="flex flex-1 gap-1">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`h-1 flex-1 ${i <= level || (level === 0 && i === 1) ? color : "bg-border"}`} />
        ))}
      </span>
      <span className="w-40 text-12 text-fg-muted">{label}</span>
    </div>
  );
}

/** New password plus confirmation, with the length rule shown up front. */
export function NewPasswordFields({
  password,
  confirm,
  onPassword,
  onConfirm,
  errors,
}: {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  errors: { password?: string; confirm?: string };
}) {
  return (
    <>
      <Field label="New password" hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`} error={errors.password}>
        <PasswordInput
          autoComplete="new-password"
          size="lg"
          value={password}
          maxLength={PASSWORD_MAX}
          onChange={(e) => onPassword(e.target.value)}
        />
      </Field>
      <StrengthHint password={password} />
      <Field label="Confirm password" error={errors.confirm}>
        <PasswordInput
          autoComplete="new-password"
          size="lg"
          value={confirm}
          maxLength={PASSWORD_MAX}
          onChange={(e) => onConfirm(e.target.value)}
        />
      </Field>
    </>
  );
}

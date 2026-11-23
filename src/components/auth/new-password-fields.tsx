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

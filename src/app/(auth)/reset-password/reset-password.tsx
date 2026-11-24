"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { AuthCard, ConfigMissing, FormError } from "@/components/auth/auth-card";
import { NewPasswordFields, validateNewPassword } from "@/components/auth/new-password-fields";
import { isApiError } from "@/lib/api/errors";
import { resetPassword } from "@/lib/api/hooks";
import { isApiConfigured } from "@/lib/env";
import { Button } from "@/ui/button";

/** Landing page for the emailed reset link (`?token=`). The token is single use and lasts an hour. */
export function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [linkBad, setLinkBad] = useState(token.length === 0);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateNewPassword(password, confirm);
    setErrors(v);
    if (v.password || v.confirm) return;
    setPending(true);
    try {
      await resetPassword(token, password);
      router.replace("/login?reset=1");
    } catch (err) {
      setPending(false);
      if (isApiError(err) && err.code === "validation" && /link/i.test(err.message)) {
        setLinkBad(true);
      } else if (isApiError(err) && err.code === "validation") {
        setErrors({ form: err.message || "Choose a password between 12 and 128 characters." });
      } else if (isApiError(err) && err.code === "rate_limited") {
        setErrors({ form: "Too many attempts. Wait a minute and try again." });
      } else {
        setErrors({ form: "Couldn't save your password. Check your connection and try again." });
      }
    }
  }

  return (
    <AuthCard title="Choose a new password" description="You'll be signed out everywhere, then sign in with the new one.">
      {!isApiConfigured ? (
        <ConfigMissing />
      ) : linkBad ? (
        <div className="flex flex-col gap-4">
          <FormError>This reset link has expired or was already used. Links work once and last an hour.</FormError>
          <Button asChild variant="primary" size="lg">
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <NewPasswordFields
            password={password}
            confirm={confirm}
            onPassword={(v) => {
              setPassword(v);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            }}
            onConfirm={(v) => {
              setConfirm(v);
              if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined }));
            }}
            errors={errors}
          />
          <FormError>{errors.form}</FormError>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            Save new password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { AuthCard, ConfigMissing, FormError } from "@/components/auth/auth-card";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";

const schema = z.object({
  email: z.email("Enter the email you were invited with."),
  password: z.string().min(1, "Enter your password."),
});

/** Sign in, then step up to TOTP when the account has a verified factor. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({ email: email.trim(), password });
    if (!parsed.success) {
      const f = z.flattenError(parsed.error).fieldErrors;
      setErrors({ email: f.email?.[0], password: f.password?.[0] });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.signInWithPassword(parsed.data);
      if (error) {
        setErrors({
          form:
            error.code === "invalid_credentials"
              ? "That email and password don't match. Check both and try again."
              : error.code === "email_not_confirmed"
                ? "This email isn't confirmed yet. Use the link in your invite email."
                : error.message,
        });
        return;
      }
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
        router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
      } else {
        router.replace(next);
        router.refresh();
      }
    } catch {
      setErrors({ form: "Can't reach the sign-in service. Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password from your invite."
      footer={
        <>
          New to the team? Ask an admin for an invite.
        </>
      }
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!isSupabaseConfigured && <ConfigMissing />}
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            autoComplete="email"
            autoFocus
            size="lg"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
            }}
          />
        </Field>
        <Field label="Password" error={errors.password}>
          <PasswordInput
            autoComplete="current-password"
            size="lg"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            }}
          />
        </Field>
        <Link
          href="/forgot-password"
          className="-mt-2 self-end rounded-xs text-12 text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          Forgot password?
        </Link>
        <FormError>{errors.form}</FormError>
        <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!isSupabaseConfigured}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

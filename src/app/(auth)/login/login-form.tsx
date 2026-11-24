"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { AuthCard, ConfigMissing, FormError, FormNotice } from "@/components/auth/auth-card";
import { TwoFactorStep } from "@/components/auth/two-factor-step";
import { isApiError } from "@/lib/api/errors";
import { isApiConfigured } from "@/lib/env";
import { signIn } from "@/lib/auth/client";
import type { TwoFactorChallenge } from "@/lib/auth/types";
import { safeNext } from "@/lib/safe-next";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";

const schema = z.object({
  email: z.email("Enter the email you were invited with."),
  password: z.string().min(1, "Enter your password."),
});

const REASONS: Record<string, string> = {
  mfa: "For security, sign in again to confirm your code.",
  expired: "Your session ended. Sign in again to pick up where you left off.",
  disabled: "This account has been disabled. Contact a workspace admin.",
};

/** Sign in with email and password, then the emailed code when the account needs one. */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const reason = params.get("reason");
  const justReset = params.get("reset") === "1";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);

  function finish() {
    router.replace(next);
    router.refresh();
  }

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
      const result = await signIn(parsed.data.email, parsed.data.password);
      if (result.kind === "two_factor") {
        setChallenge(result.challenge);
        setPassword("");
        setPending(false);
        return;
      }
      finish();
    } catch (err) {
      setPending(false);
      if (isApiError(err) && err.code === "invalid_credentials") {
        setErrors({ form: "That email and password don't match. Check both and try again, or reset your password." });
      } else if (isApiError(err) && err.code === "account_disabled") {
        setErrors({ form: "This account has been disabled. Contact a workspace admin." });
      } else if (isApiError(err) && err.code === "rate_limited") {
        setErrors({ form: "Too many sign-in attempts. Wait a minute, then try again." });
      } else if (isApiError(err) && (err.code === "network" || err.code === "unavailable")) {
        setErrors({ form: "Can't reach the sign-in service. Check your connection and try again." });
      } else {
        setErrors({ form: "Couldn't sign you in. Try again in a moment." });
      }
    }
  }

  if (challenge) {
    return (
      <AuthCard title="Check your email" description="One more step to confirm it's you.">
        <TwoFactorStep challenge={challenge} onVerified={finish} onBack={() => setChallenge(null)} />
      </AuthCard>
    );
  }

  const banner = reason ? REASONS[reason] : justReset ? "Password updated. Sign in with your new password." : undefined;

  return (
    <AuthCard
      title="Sign in"
      description="Use the email and password from your invite."
      footer={<>New to the team? Ask an admin for an invite.</>}
    >
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {!isApiConfigured && <ConfigMissing />}
        {banner &&
          (reason === "disabled" ? <FormError>{banner}</FormError> : <FormNotice>{banner}</FormNotice>)}
        <Field label="Email" error={errors.email}>
          <Input
            type="email"
            name="email"
            autoComplete="username"
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
            name="password"
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
        <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!isApiConfigured}>
          Sign in
        </Button>
      </form>
    </AuthCard>
  );
}

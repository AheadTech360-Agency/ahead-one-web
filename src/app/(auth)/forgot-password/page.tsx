"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";
import { AuthCard, ConfigMissing, FormError, FormNotice } from "@/components/auth/auth-card";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";

const emailSchema = z.email("Enter the email you sign in with.");

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    setPending(true);
    setFormError(undefined);
    try {
      const { error: sendError } = await getSupabase().auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Same answer whether or not the account exists, so the form can't be used to probe emails.
      if (sendError && sendError.status === 429) {
        setFormError("Too many requests. Wait a minute and try again.");
      } else {
        setSent(true);
      }
    } catch {
      setFormError("Can't reach the sign-in service. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Reset your password"
      description="We'll email you a link to choose a new password."
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1 rounded-xs hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Back to sign in
        </Link>
      }
    >
      {!isSupabaseConfigured ? (
        <ConfigMissing />
      ) : sent ? (
        <FormNotice>
          If an account exists for {email.trim()}, a reset link is on its way. Check your inbox and spam folder.
        </FormNotice>
      ) : (
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Field label="Email" error={error}>
            <Input
              type="email"
              autoComplete="email"
              autoFocus
              size="lg"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError(undefined);
              }}
            />
          </Field>
          <FormError>{formError}</FormError>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

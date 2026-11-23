"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, ConfigMissing } from "@/components/auth/auth-card";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { OtpInput } from "@/ui/password-input";
import { Spinner } from "@/ui/spinner";

/** TOTP challenge for a session at aal1 whose user has a verified factor. */
export function MfaChallenge() {
  const router = useRouter();
  const qc = useQueryClient();
  const next = safeNext(useSearchParams().get("next"));
  const [factorId, setFactorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;
    void (async () => {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (cancelled) return;
      if (aal?.currentLevel === "aal2") {
        router.replace(next);
        return;
      }
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (cancelled) return;
      if (listError) {
        // No session: back to sign-in.
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      const totp = data.totp[0];
      if (!totp) {
        router.replace(`/setup-mfa?next=${encodeURIComponent(next)}`);
        return;
      }
      setFactorId(totp.id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, next]);

  async function verify(value: string) {
    if (!factorId || pending) return;
    if (value.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setPending(true);
    setError(undefined);
    const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code: value });
    setPending(false);
    if (verifyError) {
      setCode("");
      setError(
        verifyError.code === "mfa_verification_failed"
          ? "That code didn't work. Codes change every 30 seconds, so enter the current one."
          : verifyError.message,
      );
      return;
    }
    await qc.invalidateQueries();
    router.replace(next);
    router.refresh();
  }

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <AuthCard
      title="Enter your verification code"
      description="Open your authenticator app and enter the 6-digit code for AheadOne."
      footer={
        isSupabaseConfigured && (
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-xs hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Sign in with a different account
          </button>
        )
      }
    >
      {!isSupabaseConfigured ? (
        <ConfigMissing />
      ) : loading ? (
        <div className="flex items-center gap-2 py-6 text-13 text-fg-muted">
          <Spinner /> Checking your sign-in
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify(code);
          }}
          noValidate
          className="flex flex-col gap-4"
        >
          <Field label="Verification code" error={error}>
            <OtpInput value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={pending} />
          </Field>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            Verify and continue
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthCard, ConfigMissing, FormError } from "@/components/auth/auth-card";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNext } from "@/lib/safe-next";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/ui/button";
import { Field } from "@/ui/field";
import { OtpInput } from "@/ui/password-input";
import { Skeleton } from "@/ui/skeleton";

type Enrollment = { factorId: string; qr: string; secret: string };

/**
 * TOTP enrolment. Required for owners and admins (API returns mfa_required).
 * Clears any half-finished enrolment first, then shows the QR code from mfa.enroll.
 */
export function SetupMfa() {
  const router = useRouter();
  const qc = useQueryClient();
  const next = safeNext(useSearchParams().get("next"));
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || started.current) return;
    started.current = true;
    const supabase = getSupabase();
    void (async () => {
      const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) {
        router.replace(`/login?next=${encodeURIComponent(`/setup-mfa?next=${next}`)}`);
        return;
      }
      if (factors.totp.length > 0) {
        // Already enrolled: this session only needs to step up.
        router.replace(`/login/mfa?next=${encodeURIComponent(next)}`);
        return;
      }
      for (const f of factors.all) {
        if (f.factor_type === "totp" && f.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: f.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Authenticator app",
      });
      if (enrollError || !data) {
        setLoadError(enrollError?.message ?? "Couldn't start setup. Reload the page to try again.");
        return;
      }
      setEnrollment({ factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    })();
  }, [router, next]);

  async function verify(value: string) {
    if (!enrollment || pending) return;
    if (value.length !== 6) {
      setError("Enter the 6-digit code your app shows for AheadOne.");
      return;
    }
    setPending(true);
    setError(undefined);
    const { error: verifyError } = await getSupabase().auth.mfa.challengeAndVerify({
      factorId: enrollment.factorId,
      code: value,
    });
    setPending(false);
    if (verifyError) {
      setCode("");
      setError(
        verifyError.code === "mfa_verification_failed"
          ? "That code didn't match. Check the time on your phone is set automatically, then enter the current code."
          : verifyError.message,
      );
      return;
    }
    await qc.invalidateQueries();
    router.replace(next);
    router.refresh();
  }

  async function copySecret() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard blocked: the key stays visible to copy by hand.
    }
  }

  return (
    <AuthCard
      title="Set up two-step verification"
      description="Your role needs a second step at sign-in. Use any authenticator app, such as 1Password, Google Authenticator or Authy."
    >
      {!isSupabaseConfigured ? (
        <ConfigMissing />
      ) : loadError ? (
        <FormError>{loadError}</FormError>
      ) : (
        <div className="flex flex-col gap-5">
          <ol className="flex flex-col gap-4 text-13">
            <li>
              <p className="font-medium text-fg">1. Scan this code with your app</p>
              <div className="mt-3 flex justify-center rounded-md border border-border bg-white p-3">
                {enrollment ? (
                  // The QR is an SVG data URL from Supabase; next/image adds nothing here.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={enrollment.qr} alt="QR code for your authenticator app" width={176} height={176} />
                ) : (
                  <Skeleton className="size-44 bg-[#e8eaea]" />
                )}
              </div>
              <details className="mt-2 text-12 text-fg-muted">
                <summary className="cursor-pointer rounded-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-ring">
                  Can&apos;t scan? Enter the key instead
                </summary>
                <div className="mt-2 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-sm bg-surface-sunken px-2 py-1.5 font-mono text-12 text-fg">
                    {enrollment?.secret ?? "..."}
                  </code>
                  <Button size="sm" variant="secondary" onClick={() => void copySecret()} disabled={!enrollment}>
                    {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                    {copied ? "Copied" : "Copy"}
                  </Button>
                </div>
              </details>
            </li>
            <li>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void verify(code);
                }}
                noValidate
                className="flex flex-col gap-3"
              >
                <Field label="2. Enter the 6-digit code it shows" error={error}>
                  <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={(v) => void verify(v)}
                    disabled={!enrollment || pending}
                    autoFocus={false}
                  />
                </Field>
                <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!enrollment}>
                  Turn on two-step verification
                </Button>
              </form>
            </li>
          </ol>
        </div>
      )}
    </AuthCard>
  );
}

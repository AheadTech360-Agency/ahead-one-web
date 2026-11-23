"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, ConfigMissing, FormError } from "@/components/auth/auth-card";
import { NewPasswordFields, validateNewPassword } from "@/components/auth/new-password-fields";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { Button } from "@/ui/button";
import { Spinner } from "@/ui/spinner";
import { toast } from "@/ui/toaster";

type Phase = "checking" | "ready" | "invalid";

/** Landing page for the recovery email link (PKCE code in the URL). */
export function ResetPassword() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");
  const [phase, setPhase] = useState<Phase>(isSupabaseConfigured ? "checking" : "invalid");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = getSupabase();
    let cancelled = false;
    void (async () => {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          // The client may already have exchanged it on load; fall through to the session check.
          const { data } = await supabase.auth.getSession();
          if (!cancelled) setPhase(data.session ? "ready" : "invalid");
          return;
        }
        if (!cancelled) setPhase("ready");
        return;
      }
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setPhase(data.session ? "ready" : "invalid");
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = validateNewPassword(password, confirm);
    setErrors(v);
    if (v.password || v.confirm) return;
    setPending(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setPending(false);
    if (error) {
      setErrors({
        form:
          error.code === "same_password"
            ? "Choose a password you haven't used here before."
            : error.code === "insufficient_aal"
              ? "Verify your sign-in code first, then set the new password."
              : error.message,
      });
      if (error.code === "insufficient_aal") router.push("/login/mfa?next=/reset-password");
      return;
    }
    toast.success("Password updated");
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthCard title="Choose a new password" description="You'll use it the next time you sign in.">
      {!isSupabaseConfigured ? (
        <ConfigMissing />
      ) : phase === "checking" ? (
        <div className="flex items-center gap-2 py-6 text-13 text-fg-muted">
          <Spinner /> Checking your reset link
        </div>
      ) : phase === "invalid" ? (
        <div className="flex flex-col gap-4">
          <FormError>This reset link has expired or was already used.</FormError>
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

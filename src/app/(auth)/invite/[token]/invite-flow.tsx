"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, Clock } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthCard, ConfigMissing, FormError } from "@/components/auth/auth-card";
import { NewPasswordFields, validateNewPassword } from "@/components/auth/new-password-fields";
import { errorMessage, isApiError } from "@/lib/api/client";
import { acceptInvite, registerInvite, useInvitePreview } from "@/lib/api/hooks";
import type { InvitePreview, Role } from "@/lib/api/types";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabase } from "@/lib/supabase/client";
import { ROLE_LABEL } from "@/lib/workspace";
import { Button } from "@/ui/button";
import { EmptyState } from "@/ui/empty-state";
import { Field } from "@/ui/field";
import { Input } from "@/ui/input";
import { PasswordInput } from "@/ui/password-input";
import { Skeleton } from "@/ui/skeleton";

/** Roles that must enrol TOTP before using the app (contract: mfa_required for owner/admin). */
const MFA_ROLES: Role[] = ["owner", "admin"];

/*
 * Invite flow:
 *   GET /v1/invites/preview?token=  (public)
 *   account_exists = false: full name + password -> POST /v1/invites/register -> sign in -> app
 *   account_exists = true:  sign in (inline) -> POST /v1/invites/accept -> app
 * Owners and admins continue to /setup-mfa (or /login/mfa) before landing in the app.
 */
export function InviteFlow() {
  const { token } = useParams<{ token: string }>();
  const preview = useInvitePreview(token);

  if (!isSupabaseConfigured) {
    return (
      <AuthCard title="Join workspace">
        <ConfigMissing />
      </AuthCard>
    );
  }

  if (preview.isPending) {
    return (
      <AuthCard title="Join workspace" description="Checking your invite.">
        <div className="flex flex-col gap-3" role="status" aria-label="Loading invite">
          <Skeleton className="h-3 w-3/4" />
          <Skeleton className="h-9 w-full rounded-sm" />
          <Skeleton className="h-9 w-full rounded-sm" />
        </div>
      </AuthCard>
    );
  }

  if (preview.isError) {
    const notFound = isApiError(preview.error) && (preview.error.status === 404 || preview.error.status === 422);
    return (
      <AuthCard title="This invite can't be used">
        <EmptyState
          compact
          tone="danger"
          icon={CircleAlert}
          title={notFound ? "Invite not found" : "Couldn't check this invite"}
          description={
            notFound
              ? "The link may be incomplete or the invite was revoked. Ask the person who invited you to send a new one."
              : errorMessage(preview.error)
          }
          action={
            !notFound && (
              <Button size="sm" onClick={() => preview.refetch()}>
                Try again
              </Button>
            )
          }
        />
      </AuthCard>
    );
  }

  const p = preview.data;
  if (p.expired) {
    return (
      <AuthCard title="This invite has expired">
        <EmptyState
          compact
          icon={Clock}
          title={`Invite to ${p.workspace_name} expired`}
          description="Ask a workspace admin to resend it. The new email has a fresh link."
        />
      </AuthCard>
    );
  }

  return p.account_exists ? <AcceptWithSignIn token={token} preview={p} /> : <Register token={token} preview={p} />;
}

function InviteSummary({ p }: { p: InvitePreview }) {
  return (
    <dl className="mb-5 grid grid-cols-[88px_1fr] gap-y-1.5 rounded-md bg-surface-sunken px-3 py-2.5 text-13">
      <dt className="text-fg-muted">Workspace</dt>
      <dd className="truncate font-medium text-fg">{p.workspace_name}</dd>
      <dt className="text-fg-muted">Email</dt>
      <dd className="truncate text-fg">{p.email}</dd>
      <dt className="text-fg-muted">Role</dt>
      <dd className="text-fg">{ROLE_LABEL[p.role]}</dd>
    </dl>
  );
}

/** After sign-in: step up or enrol MFA when the role needs it, otherwise go to the app. */
async function continueAfterSignIn(role: Role, router: ReturnType<typeof useRouter>) {
  const { data } = await getSupabase().auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
    router.replace("/login/mfa?next=/");
  } else if (MFA_ROLES.includes(role) && data?.currentLevel !== "aal2") {
    router.replace("/setup-mfa?next=/");
  } else {
    router.replace("/");
  }
  router.refresh();
}

function Register({ token, preview }: { token: string; preview: InvitePreview }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ name?: string; password?: string; confirm?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = { ...validateNewPassword(password, confirm), name: name.trim() ? undefined : "Enter your name as teammates should see it." };
    setErrors(v);
    if (v.name || v.password || v.confirm) return;
    setPending(true);
    try {
      await registerInvite({ token, full_name: name.trim(), password });
    } catch (err) {
      setPending(false);
      if (isApiError(err) && err.code === "conflict") {
        setErrors({ form: "An account already exists for this email. Sign in instead." });
        void qc.invalidateQueries({ queryKey: ["invite-preview", token] });
      } else if (isApiError(err) && err.code === "validation") {
        setErrors({ form: err.message || "Check your details and try again." });
      } else {
        setErrors({ form: errorMessage(err) });
      }
      return;
    }
    const { error } = await getSupabase().auth.signInWithPassword({ email: preview.email, password });
    if (error) {
      setPending(false);
      // Account exists now; send them to sign in normally.
      router.replace(`/login?next=/`);
      return;
    }
    await continueAfterSignIn(preview.role, router);
  }

  return (
    <AuthCard
      title={`Join ${preview.workspace_name}`}
      description="Create your account to accept the invite."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} className="font-medium text-fg hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <InviteSummary p={preview} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Full name" error={errors.name}>
          <Input
            autoFocus
            autoComplete="name"
            size="lg"
            value={name}
            maxLength={120}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((x) => ({ ...x, name: undefined }));
            }}
          />
        </Field>
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
          Create account and join
        </Button>
      </form>
    </AuthCard>
  );
}

function AcceptWithSignIn({ token, preview }: { token: string; preview: InvitePreview }) {
  const router = useRouter();
  const [sessionEmail, setSessionEmail] = useState<string | null | undefined>(undefined);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getSupabase()
      .auth.getUser()
      .then(({ data }) => {
        if (!cancelled) setSessionEmail(data.user?.email ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const signedInAsInvitee = sessionEmail?.toLowerCase() === preview.email.toLowerCase();

  async function accept() {
    setPending(true);
    setError(undefined);
    try {
      await acceptInvite(token);
    } catch (err) {
      setPending(false);
      if (isApiError(err) && err.code === "mfa_required") {
        router.replace(`/login/mfa?next=${encodeURIComponent(`/invite/${token}`)}`);
        return;
      }
      setError(
        isApiError(err) && err.code === "forbidden"
          ? `This invite is for ${preview.email}. Sign in with that email to accept it.`
          : errorMessage(err),
      );
      return;
    }
    await continueAfterSignIn(preview.role, router);
  }

  async function signInAndAccept(e: React.FormEvent) {
    e.preventDefault();
    if (!password) {
      setError("Enter your password.");
      return;
    }
    setPending(true);
    setError(undefined);
    const supabase = getSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: preview.email, password });
    if (signInError) {
      setPending(false);
      setError(
        signInError.code === "invalid_credentials"
          ? "That password doesn't match this account."
          : signInError.message,
      );
      return;
    }
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
      // Verify the code first, then come back here to accept.
      router.replace(`/login/mfa?next=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    await accept();
  }

  async function switchAccount() {
    await getSupabase().auth.signOut();
    setSessionEmail(null);
  }

  return (
    <AuthCard
      title={`Join ${preview.workspace_name}`}
      description={signedInAsInvitee ? "You're signed in with the invited email." : "You already have an account. Sign in to accept."}
    >
      <InviteSummary p={preview} />
      {sessionEmail === undefined ? (
        <Skeleton className="h-9 w-full rounded-sm" />
      ) : signedInAsInvitee ? (
        <div className="flex flex-col gap-4">
          <FormError>{error}</FormError>
          <Button variant="primary" size="lg" loading={pending} onClick={() => void accept()}>
            Accept invite
          </Button>
        </div>
      ) : sessionEmail ? (
        <div className="flex flex-col gap-4">
          <FormError>
            You&apos;re signed in as {sessionEmail}. This invite is for {preview.email}.
          </FormError>
          <Button variant="secondary" size="lg" onClick={() => void switchAccount()}>
            Sign out and continue as {preview.email}
          </Button>
        </div>
      ) : (
        <form onSubmit={signInAndAccept} noValidate className="flex flex-col gap-4">
          <Field label="Email">
            <Input value={preview.email} readOnly disabled size="lg" />
          </Field>
          <Field label="Password" error={error}>
            <PasswordInput
              autoFocus
              autoComplete="current-password"
              size="lg"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(undefined);
              }}
            />
          </Field>
          <Link
            href="/forgot-password"
            className="-mt-2 self-end rounded-xs text-12 text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Forgot password?
          </Link>
          <Button type="submit" variant="primary" size="lg" loading={pending}>
            Sign in and accept
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

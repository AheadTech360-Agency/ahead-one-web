"use client";

import { ArrowLeft, MailCheck } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { isApiError } from "@/lib/api/errors";
import { resendCode, verifyCode } from "@/lib/auth/client";
import type { TwoFactorChallenge } from "@/lib/auth/types";
import { Button } from "@/ui/button";
import { CodeInput } from "./code-input";
import { FormError, FormNotice } from "./auth-card";

/** The API allows 5 tries per code. */
const MAX_TRIES = 5;

function clock(total: number) {
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Second step of sign-in: the 6-digit code that was emailed. Verifies on the sixth digit,
 * counts down to "Send a new code", and explains every failure with a way forward.
 */
export function TwoFactorStep({
  challenge: initial,
  onVerified,
  onBack,
}: {
  challenge: TwoFactorChallenge;
  onVerified: () => void | Promise<void>;
  onBack: () => void;
}) {
  const [challenge, setChallenge] = useState(initial);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [tries, setTries] = useState(0);
  const [pending, setPending] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(initial.resend_after);
  const [dead, setDead] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = useCallback(
    async (value: string) => {
      if (busy.current || value.length !== 6 || dead) return;
      busy.current = true;
      setPending(true);
      setError(undefined);
      setNotice(undefined);
      try {
        await verifyCode(challenge.challenge_id, value);
        await onVerified();
      } catch (e) {
        if (!mounted.current) return;
        setCode("");
        if (isApiError(e) && e.code === "invalid_code") {
          const n = tries + 1;
          setTries(n);
          if (n >= MAX_TRIES) {
            setDead(true);
            setError("Too many wrong codes, so this one is locked. Send a new code, or go back and sign in again.");
          } else {
            setError(
              `That code didn't work. Check the newest email (${MAX_TRIES - n} ${MAX_TRIES - n === 1 ? "try" : "tries"} left), or send a new code.`,
            );
          }
        } else if (isApiError(e) && e.code === "rate_limited") {
          setError("Too many attempts from this network. Wait a minute, then try the code again.");
        } else if (isApiError(e) && (e.code === "account_disabled")) {
          setError("This account has been disabled. Contact a workspace admin.");
        } else if (isApiError(e) && e.code === "network") {
          setError("Can't reach the server. Check your connection and enter the code again.");
        } else {
          setError("Something went wrong checking that code. Try again, or go back and sign in again.");
        }
      } finally {
        busy.current = false;
        if (mounted.current) setPending(false);
      }
    },
    [challenge.challenge_id, dead, onVerified, tries],
  );

  async function resend() {
    setResending(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const r = await resendCode(challenge.challenge_id);
      setChallenge((c) => ({ ...c, email_hint: r.email_hint, expires_in: r.expires_in, resend_after: r.resend_after }));
      setWait(r.resend_after);
      setTries(0);
      setDead(false);
      setCode("");
      setNotice(`New code sent to ${r.email_hint}. The old one no longer works.`);
    } catch (e) {
      if (isApiError(e) && e.code === "conflict") {
        setError("You can't request another code just yet, or you've used all your resends. Wait a minute, or go back and sign in again.");
        setWait((w) => Math.max(w, 30));
      } else if (isApiError(e) && e.code === "rate_limited") {
        setError("Too many requests. Wait a minute and try again.");
      } else {
        setError("Couldn't send a new code. Check your connection and try again.");
      }
    } finally {
      setResending(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <p className="flex items-start gap-2.5 text-13 text-fg-muted">
        <MailCheck className="mt-0.5 size-4 shrink-0 text-green-text" aria-hidden />
        <span>
          We sent a code to <strong className="font-semibold text-fg">{challenge.email_hint}</strong>. It expires in{" "}
          {Math.round(challenge.expires_in / 60)} minutes.
        </span>
      </p>
      <CodeInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={pending || dead} invalid={Boolean(error)} />
      {/* Always mounted so screen readers announce changes. */}
      <div aria-live="polite" className="empty:hidden">
        {error ? <FormError>{error}</FormError> : notice ? <FormNotice>{notice}</FormNotice> : null}
      </div>
      <Button type="submit" variant="primary" size="lg" loading={pending} disabled={code.length !== 6 || dead}>
        Verify and sign in
      </Button>
      <div className="flex flex-col-reverse gap-3 text-13 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 self-start rounded-xs text-fg-muted hover:text-fg hover:underline focus-visible:outline-2 focus-visible:outline-ring"
        >
          <ArrowLeft className="size-3.5" aria-hidden /> Use a different account
        </button>
        {wait > 0 ? (
          <span className="tabular text-fg-muted">Send a new code in {clock(wait)}</span>
        ) : (
          <button
            type="button"
            onClick={() => void resend()}
            disabled={resending}
            className="rounded-xs font-medium text-accent-text underline underline-offset-4 hover:decoration-green focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
          >
            {resending ? "Sending" : "Send a new code"}
          </button>
        )}
      </div>
    </form>
  );
}

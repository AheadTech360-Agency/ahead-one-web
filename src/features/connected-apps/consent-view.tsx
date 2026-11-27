"use client";

import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { errorMessage, isApiError } from "@/lib/api/client";
import { useMe } from "@/lib/api/hooks";
import { signOut } from "@/lib/auth/client";
import { useOAuthDecision, useOAuthRequest } from "./api";
import { ConsentCard, ConsentProblem, ConsentSkeleton, type ConsentPhase } from "./consent-card";
import { isExpired, isSafeRedirect, requestProblem } from "./logic";

/** An opaque id is URL-safe (letters, digits, "-" and "_"); anything else is treated as an invalid link. */
const REQUEST_ID = /^[A-Za-z0-9_-]{8,200}$/;

/**
 * /oauth/consent?request=<opaque id>. Loads the request, shows the consent card, posts the decision
 * and only then leaves, and only to a redirect that matches the client's registered redirect URI.
 * The id is the only thing in the URL; nothing from the request is logged or stored.
 */
export function ConsentView() {
  const params = useSearchParams();
  const raw = params.get("request");
  const id = raw && REQUEST_ID.test(raw) ? raw : undefined;
  const me = useMe();
  const q = useOAuthRequest(id);
  const decide = useOAuthDecision(id ?? "");
  const [phase, setPhase] = useState<ConsentPhase>("idle");
  const [error, setError] = useState<string | undefined>();
  const [unsafe, setUnsafe] = useState(false);
  // A ref, not state: two clicks in the same frame must not both reach the API.
  const locked = useRef(false);

  if (!id) return <ConsentProblem kind="invalid" />;
  if (unsafe) return <ConsentProblem kind="unsafe" />;
  if (q.isPending) return <ConsentSkeleton />;
  if (q.isError || !q.data) {
    const status = isApiError(q.error) ? q.error.status : undefined;
    const kind = requestProblem(status);
    return <ConsentProblem kind={kind} onRetry={() => void q.refetch()} />;
  }
  const info = q.data;
  if (isExpired(info.expires_at)) return <ConsentProblem kind="expired" />;

  function onDecide(approve: boolean, scopes: string[]) {
    if (locked.current) return;
    locked.current = true;
    setPhase("submitting");
    setError(undefined);
    decide.mutate(
      { approve, scopes },
      {
        onSuccess: (res) => {
          if (!isSafeRedirect(res?.redirect_url, info.redirect_uri)) {
            setUnsafe(true);
            return;
          }
          setPhase("redirecting");
          // Stay locked: the page is leaving.
          window.location.assign(res.redirect_url);
        },
        onError: (e) => {
          const status = isApiError(e) ? e.status : undefined;
          if (status === 410 || status === 404) {
            // Expired or already decided: reload into the matching problem state.
            void q.refetch();
            setPhase("idle");
            locked.current = false;
            return;
          }
          setPhase("error");
          setError(errorMessage(e));
          locked.current = false;
        },
      },
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      <ConsentCard
        info={info}
        userName={me.data?.user.full_name || me.data?.user.email}
        userEmail={me.data?.user.email}
        phase={phase}
        error={error}
        onDecide={onDecide}
      />
      <p className="text-12 text-fg-muted">
        Not you?{" "}
        <button
          type="button"
          className="rounded-xs font-medium text-fg underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </p>
    </div>
  );
}

import type { Aal } from "@/lib/api/types";

/** What the BFF routes return to the browser. The refresh token never appears here. */
export type SessionBody = { access_token: string; expires_in: number; aal: Aal };

export type TwoFactorChallenge = {
  challenge_id: string;
  email_hint: string;
  expires_in: number;
  resend_after: number;
};

/** Why the browser is being sent back to sign in. */
export type SignInReason = "expired" | "mfa" | "disabled";

/**
 * Header every BFF POST must carry. A cross-site form cannot set it, and a cross-site fetch
 * would need a CORS preflight these routes never grant.
 */
export const CSRF_HEADER = "x-ahead-csrf";

/*
 * What to do about push right after a sign-in. Pure, so it is unit tested without a browser.
 * Only runs while the "fresh sign-in" flag is set; the flag is consumed once a decision is made.
 */

export type PushLoginInput = {
  /** Push is configured for the workspace and the browser supports it. */
  available: boolean;
  permission: NotificationPermission | "unsupported";
  /** Permission granted and a token is registered on this browser. */
  enabled: boolean;
  /** This sign-in has not been handled yet. */
  freshLogin: boolean;
};

export type PushLoginAction = "none" | "offer" | "silent-register" | "denied-notice";

export function decidePushLogin(i: PushLoginInput): PushLoginAction {
  if (!i.freshLogin || !i.available || i.permission === "unsupported") return "none";
  if (i.enabled) return "none";
  if (i.permission === "default") return "offer";
  if (i.permission === "granted") return "silent-register";
  return "denied-notice";
}

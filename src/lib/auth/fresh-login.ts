/*
 * "This browser just signed in" marker. Set by a real sign-in (password or emailed code), never by
 * a page load or a silent session refresh, and consumed once by the push prompt. Kept in
 * localStorage so a reload before the user answers does not lose it; cleared on sign-out.
 */
const KEY = "ahead-one.fresh-login";

export function markFreshLogin() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Storage blocked: the push prompt simply won't appear.
  }
}
export function hasFreshLogin() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}
export function clearFreshLogin() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

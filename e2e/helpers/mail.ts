import fs from "node:fs";
import { apiLogFile } from "./config";

/*
 * With SMTP unset the API (APP_ENV=development) logs every email at info level, e.g.
 *   <ts> INFO ...: email (not sent: SMTP_HOST unset) to=a@b.test subject=... body=Your AheadTech360 sign-in code is 123456. ...
 * The body can span several lines. Helpers here read that log. Always pass a `since` offset (from logSize())
 * so an old code or link is never reused.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ENTRY_START = /\r?\n(?=\d{4}-\d{2}-\d{2}T)/;
const SIGN_IN_CODE = /sign-in code is (\d{6})/;
const INVITE_LINK = /https?:\/\/[^\s"\\]+?\/invite\/[A-Za-z0-9_-]+/;

export function logSize(): number {
  try {
    return fs.statSync(apiLogFile).size;
  } catch {
    return 0;
  }
}

function readFrom(offset: number): string {
  try {
    const buf = fs.readFileSync(apiLogFile);
    return buf.subarray(Math.min(offset, buf.length)).toString("utf8");
  } catch {
    return "";
  }
}

/** Log entries for emails to `email` since the offset. Entries are split on the timestamp prefix. */
function emailEntries(email: string, since: number): string[] {
  const needle = `to=${email.toLowerCase()}`;
  return readFrom(since)
    .split(ENTRY_START)
    .filter((l) => l.includes("email (not sent") && l.toLowerCase().includes(needle));
}

async function waitFor<T>(find: () => T | undefined, what: string, timeoutMs: number): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const found = find();
    if (found !== undefined) return found;
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${what} in ${apiLogFile}`);
    await sleep(250);
  }
}

/** The newest 6-digit sign-in code emailed to `email` since the given log offset. */
export function waitForSignInCode(email: string, since: number, timeoutMs = 20_000): Promise<string> {
  return waitFor(
    () =>
      emailEntries(email, since)
        .map((l) => SIGN_IN_CODE.exec(l)?.[1])
        .filter((c): c is string => Boolean(c))
        .at(-1),
    `sign-in code for ${email}`,
    timeoutMs,
  );
}

/** The newest invite link emailed to `email` since the given log offset. */
export function waitForInviteLink(email: string, since: number, timeoutMs = 20_000): Promise<string> {
  return waitFor(
    () =>
      emailEntries(email, since)
        .map((l) => INVITE_LINK.exec(l)?.[0])
        .filter((u): u is string => Boolean(u))
        .at(-1),
    `invite link for ${email}`,
    timeoutMs,
  );
}

/** A code that is guaranteed to differ from the real one, for the wrong-code check. */
export function wrongCodeFor(real: string): string {
  return real === "000000" ? "111111" : "000000";
}

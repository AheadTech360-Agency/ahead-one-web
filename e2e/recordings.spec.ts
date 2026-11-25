import { expect, type Page, test } from "@playwright/test";
import { logSize, waitForSignInCode } from "./helpers/mail";
import { webUrl } from "./helpers/config";
import { loadRun } from "./helpers/run";
import { enterCode, expectSignedIn } from "./helpers/ui";

/*
 * Screen recorder and Files view. Chromium is started with its fake capture flags, so getDisplayMedia and
 * getUserMedia succeed without a prompt and produce a synthetic test pattern (and a beep for the microphone).
 *
 * Recording, the review step and the Files filters need no storage. Saving needs the API's object storage (R2)
 * to be configured AND reachable from the browser (bucket CORS must allow the web origin). When it is not, the
 * API answers 503 or the PUT is blocked; the spec then skips the saving and playback steps with a note instead
 * of faking an upload.
 *
 * E2E_PROXY_R2_UPLOAD=1 is for environments whose bucket CORS does not list the test web origin: the browser's
 * PUT is relayed by Node to the real signed URL and answered with CORS headers. The bytes still go to the real
 * bucket; only the browser-to-bucket CORS hop is bridged.
 *
 * It uses the Owner created by journey.spec.ts (it runs after it, alphabetically). Run on its own, it accepts the
 * invite first.
 */
test.describe.configure({ mode: "serial" });
test.use({
  permissions: ["microphone"],
  launchOptions: {
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--auto-accept-this-tab-capture",
      "--auto-select-desktop-capture-source=Entire screen",
      "--auto-select-tab-capture-source-by-title=AheadOne",
    ],
  },
});

const run = loadRun();
const title = `E2E recording ${run.ts}`;
let page: Page;
let saved = false;
let skipReason = "";
const diagnostics: string[] = [];
/** E2E_SCREENSHOTS=1 saves a few pictures of the new screens to test-results/screens for a visual check. */
const shot = async (name: string, opts: { fullPage?: boolean } = {}) => {
  if (process.env.E2E_SCREENSHOTS === "1") await page.screenshot({ path: `test-results/screens/${name}.png`, ...opts });
};

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["microphone"] });
  page = await ctx.newPage();
  if (process.env.E2E_PROXY_R2_UPLOAD === "1") {
    const cors = {
      "access-control-allow-origin": webUrl,
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "PUT,GET,OPTIONS",
      "access-control-expose-headers": "*",
    };
    await page.route(/r2\.cloudflarestorage\.com/, async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      if (req.method() !== "PUT") return route.continue();
      const res = await fetch(req.url(), { method: "PUT", headers: { "content-type": req.headers()["content-type"] ?? "" }, body: new Uint8Array(req.postDataBuffer() ?? Buffer.alloc(0)) });
      return route.fulfill({ status: res.status, headers: cors, body: await res.text() });
    });
  }
  // Kept for the skip note: a blocked upload (CSP, bucket CORS) shows up here.
  page.on("requestfailed", (r) => diagnostics.push(`${r.method()} ${new URL(r.url()).origin} ${r.failure()?.errorText ?? ""}`));
  page.on("console", (m) => m.type() === "error" && diagnostics.push(`console: ${m.text().slice(0, 200)}`));
  await page.goto("/login");
  const since = logSize();
  await page.getByLabel("Email").fill(run.ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(run.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const code = page.getByRole("heading", { name: "Check your email" });
  const failed = page.getByRole("alert").filter({ hasText: /\S/ });
  await expect(code.or(failed)).toBeVisible({ timeout: 60_000 });
  if (await failed.isVisible()) {
    const text = (await failed.first().innerText()).trim();
    // Anything but "wrong email or password" (for example a rate limit) is a real failure, not a missing account.
    if (!/email and password|email or password|incorrect|invalid|match/i.test(text)) throw new Error(`Sign-in failed: ${text}`);
    // The journey has not run: accept the invite as the Owner.
    await page.goto(run.inviteLink);
    await page.getByLabel("Full name").fill(run.ownerName);
    await page.getByLabel("New password").fill(run.password);
    await page.getByLabel("Confirm password").fill(run.password);
    const s2 = logSize();
    await page.getByRole("button", { name: "Create account and join" }).click();
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible({ timeout: 60_000 });
    await enterCode(page, await waitForSignInCode(run.ownerEmail, s2));
  } else {
    await enterCode(page, await waitForSignInCode(run.ownerEmail, since));
  }
  await expectSignedIn(page);
});

test.afterAll(async () => {
  await page?.context().close();
});

test("the sidebar has Files, and Home shows the Files card", async () => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Files" }).first()).toBeVisible();
  const card = page.locator('[data-testid="files-card"]:visible');
  await expect(card).toBeVisible();
  await expect(card.getByText("Expiring soon")).toBeVisible();
});

test("Files filters write the URL and the API query", async () => {
  await page.goto("/files");
  await expect(page.getByRole("heading", { name: "Files", level: 1 })).toBeVisible();

  const reqFor = (needle: string) => page.waitForRequest((r) => r.url().includes("/files?") && r.url().includes(needle));

  const recordings = reqFor("source=recordings");
  await page.getByRole("tab", { name: "Recordings" }).click();
  await recordings;
  await expect(page).toHaveURL(/source=recordings/);

  await page.getByRole("tab", { name: "All files" }).click();
  await expect(page).not.toHaveURL(/source=/);

  const typed = reqFor("type=video");
  await page.getByRole("combobox", { name: "File type" }).click();
  await page.getByRole("option", { name: "Videos" }).click();
  await typed;
  await expect(page).toHaveURL(/type=video/);

  const searched = reqFor("q=zzz-no-such-file");
  await page.getByLabel("Search files by name").fill("zzz-no-such-file");
  await searched;
  await expect(page).toHaveURL(/q=zzz-no-such-file/);
  await expect(page.getByText("No files match")).toBeVisible();

  await page.getByRole("button", { name: "Clear filters" }).first().click();
  await expect(page).not.toHaveURL(/q=|type=/);
});

test("record a few seconds with voice, then review it", async () => {
  await page.goto("/files?source=recordings");
  await page.getByTestId("record-screen").first().click();
  const dialog = page.getByRole("dialog", { name: "Record your screen" });
  await expect(dialog).toBeVisible();
  // Voice is off by default.
  await expect(dialog.getByRole("checkbox", { name: /Record my voice/ })).not.toBeChecked();
  await dialog.getByRole("checkbox", { name: /Record my voice/ }).click();
  await dialog.getByTestId("recorder-start").click();

  await expect(page.getByTestId("countdown")).toBeVisible({ timeout: 20_000 });
  const hud = page.getByTestId("recorder-hud");
  await expect(hud).toBeVisible({ timeout: 10_000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("recorder-pause").click();
  await expect(hud.getByText("Paused", { exact: true })).toBeVisible();
  await page.getByTestId("recorder-pause").click();
  await page.waitForTimeout(2500);
  await expect(page.getByTestId("recorder-timer")).not.toHaveText("0:00");
  await page.getByTestId("recorder-stop").click();

  const review = page.getByRole("dialog", { name: "Review your recording" });
  await expect(review).toBeVisible({ timeout: 20_000 });
  await expect(review.getByTestId("recording-preview")).toBeVisible();
  await expect(review.getByText("With sound")).toBeVisible();
  await review.getByTestId("recording-title").fill(title);
  await shot("review");
});

test("save it: the recording is private and lands in Files", async () => {
  // The dialog title changes from "Review your recording" to "Recording saved", so address it by role only.
  const review = page.getByRole("dialog");
  await expect(review.getByText(/Only you can see it/)).toBeVisible();
  await review.getByTestId("recording-save").click();

  const ok = review.getByTestId("recording-saved");
  const failed = review.getByRole("alert");
  await expect(ok.or(failed)).toBeVisible({ timeout: 90_000 });
  if (await failed.isVisible()) {
    skipReason = (await failed.innerText()).trim();
    console.log("[recordings e2e] saving skipped:", skipReason, diagnostics.slice(-6));
    test.skip(true, `Object storage is not usable from this run, so saving and playback are not exercised: ${skipReason}`);
  }
  saved = true;
  await shot("saved");
  await review.getByRole("button", { name: "Done" }).click();
  await page.goto("/files?source=recordings");
  const card = page.getByTestId("file-card").filter({ hasText: title });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await expect(card.getByRole("button", { name: /Attach to task/ })).toBeVisible();
  await expect(card.getByLabel("Has sound")).toBeVisible();
  await shot("files-recordings");
});

test("play it from Files in the dialog player", async () => {
  test.skip(!saved, `Needs a saved recording. ${skipReason}`);
  await page.goto("/files?source=recordings");
  const card = page.getByTestId("file-card").filter({ hasText: title });
  await card.getByRole("button", { name: new RegExp(`Open ${title}`) }).click();
  const video = page.getByRole("dialog").getByTestId("media-video");
  await expect(video).toBeVisible({ timeout: 20_000 });
  // The signed URL loaded (media-src allows R2): metadata arrives and the element has no error.
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => (v.error ? -1 : v.readyState)), { timeout: 30_000 }).toBeGreaterThanOrEqual(1);
});

test("attach the recording to a task from Files", async () => {
  test.skip(!saved, `Needs a saved recording. ${skipReason}`);
  await page.keyboard.press("Escape");
  await page.goto("/files?source=recordings");
  const card = page.getByTestId("file-card").filter({ hasText: title });
  await card.getByRole("button", { name: "Attach to task" }).click();
  const dialog = page.getByRole("dialog", { name: "Attach to a task" });
  await dialog.getByLabel("Search tasks").fill("Write launch email");
  const hit = dialog.getByRole("button", { name: /Write launch email/ }).first();
  test.skip(!(await hit.waitFor({ state: "visible", timeout: 15_000 }).then(() => true, () => false)), "The journey's task does not exist in this workspace.");
  await hit.click();
  await expect(page.getByText(/Attached to Write launch email/)).toBeVisible();
  await page.goto("/files");
  await expect(page.getByTestId("file-row").filter({ hasText: title }).getByText(/Write launch email/)).toBeVisible();
  await shot("files-list");
  await page.goto("/");
  await expect(page.locator('[data-testid="files-card"]:visible')).toBeVisible();
  await shot("home", { fullPage: true });
});

import { expect, type Page, test } from "@playwright/test";
import { logSize, waitForSignInCode } from "./helpers/mail";
import { apiUrl, webUrl } from "./helpers/config";
import { loadRun } from "./helpers/run";
import { enterCode, expectSignedIn } from "./helpers/ui";

/*
 * Android app download. The release endpoint is mocked with page.route, so no APK exists or is downloaded:
 * the R2 URL is fulfilled by the test itself. Uses the Owner created by journey.spec.ts (it runs earlier,
 * alphabetically); run on its own, it accepts the invite first.
 */
test.describe.configure({ mode: "serial" });

const run = loadRun();
const SHA = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
let page: Page;

const cors = {
  "access-control-allow-origin": webUrl,
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ acceptDownloads: true });
  page = await ctx.newPage();
  await page.goto("/login");
  const since = logSize();
  await page.getByLabel("Email").fill(run.ownerEmail);
  await page.getByLabel("Password", { exact: true }).fill(run.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const code = page.getByRole("heading", { name: "Check your email" });
  const failed = page.getByRole("alert").filter({ hasText: /\S/ });
  await expect(code.or(failed)).toBeVisible({ timeout: 60_000 });
  if (await failed.isVisible()) {
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

test("the Android app card renders and Download APK navigates to a fresh R2 link", async () => {
  let calls = 0;
  await page.route(`${apiUrl}/v1/workspaces/*/app/releases/android/latest`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    calls += 1;
    await route.fulfill({
      status: 200,
      headers: { ...cors, "cache-control": "no-store" },
      contentType: "application/json",
      body: JSON.stringify({
        version_name: "1.4.2",
        version_code: 42,
        notes: "Faster task list and fixes.",
        size_bytes: 52_428_800,
        sha256: SHA,
        updated_at: "2026-11-26T10:00:00Z",
        download_url: `https://e2e-acct.r2.cloudflarestorage.com/bucket/AheadOne-1.4.2.apk?sig=call-${calls}`,
        expires_at: "2026-11-26T10:15:00Z",
      }),
    });
  });
  const downloadUrls: string[] = [];
  await page.route("https://*.r2.cloudflarestorage.com/**", async (route) => {
    downloadUrls.push(route.request().url());
    await route.fulfill({
      status: 200,
      headers: { "content-disposition": 'attachment; filename="AheadOne-1.4.2.apk"' },
      contentType: "application/vnd.android.package-archive",
      body: "not a real apk",
    });
  });

  await page.goto("/settings/android-app");
  await expect(page.getByRole("heading", { name: "Get the Android app", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Version 1\.4\.2/ })).toBeVisible();
  await expect(page.getByText("Build 42")).toBeVisible();
  await expect(page.getByText("50.0 MB")).toBeVisible();
  await expect(page.getByText("Faster task list and fixes.")).toBeVisible();
  await expect(page.getByText("01234567…89abcdef")).toBeVisible();
  await expect(page.getByText("Android phones only").first()).toBeVisible();
  // Metadata only on load: the signed link is neither rendered nor fetched for navigation yet.
  await expect(page.locator("body")).not.toContainText("r2.cloudflarestorage.com");
  expect(downloadUrls).toHaveLength(0);
  expect(calls).toBe(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download APK" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("AheadOne-1.4.2.apk");
  expect(calls).toBe(2); // a fresh request on click
  expect(downloadUrls).toHaveLength(1);
  expect(downloadUrls[0]).toContain("sig=call-2");
  await expect(page).toHaveURL(/\/settings\/android-app$/);
});

test("a link that is not on R2 is refused", async () => {
  await page.unroute(`${apiUrl}/v1/workspaces/*/app/releases/android/latest`);
  await page.route(`${apiUrl}/v1/workspaces/*/app/releases/android/latest`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    await route.fulfill({
      status: 200,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({
        version_name: "1.4.2",
        version_code: 42,
        notes: null,
        size_bytes: 1024,
        sha256: SHA,
        updated_at: "2026-11-26T10:00:00Z",
        download_url: "https://evil.example.com/AheadOne.apk",
        expires_at: "2026-11-26T10:15:00Z",
      }),
    });
  });
  await page.goto("/settings/android-app");
  await page.getByRole("button", { name: "Download APK" }).click();
  await expect(page.getByText("Couldn't start the download").first()).toBeVisible();
  await expect(page).toHaveURL(/\/settings\/android-app$/);
});

test("404 shows the empty state", async () => {
  await page.unroute(`${apiUrl}/v1/workspaces/*/app/releases/android/latest`);
  await page.route(`${apiUrl}/v1/workspaces/*/app/releases/android/latest`, async (route) => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    await route.fulfill({
      status: 404,
      headers: cors,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "not_found", message: "No release" } }),
    });
  });
  await page.goto("/settings/android-app");
  await expect(page.getByText("No app build has been published yet")).toBeVisible();
});

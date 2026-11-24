import { expect, type Page } from "@playwright/test";

/** Types a 6-digit code into the (visually hidden) code field of the second sign-in step. */
export async function enterCode(page: Page, code: string): Promise<void> {
  await page.getByLabel("6-digit sign-in code").fill(code);
}

export async function signInWithPassword(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

/** Resolves once the signed-in app shell is on screen. */
export async function expectSignedIn(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: /^Notifications/ })).toBeVisible({ timeout: 60_000 });
}

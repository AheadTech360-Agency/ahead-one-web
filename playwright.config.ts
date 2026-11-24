import { defineConfig, devices } from "@playwright/test";
import { webUrl } from "./e2e/helpers/config";

/*
 * End-to-end suite. global-setup starts the Rust API (logging emails to a file) and the Next.js app,
 * creates a fresh workspace, and the teardown stops whatever it started. See "End-to-end tests" in CLAUDE.md.
 * The journey is one serial spec, so a single worker.
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: webUrl,
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

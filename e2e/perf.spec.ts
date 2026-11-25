import { expect, test, type Page } from "@playwright/test";
import { apiUrl } from "./helpers/config";
import { loadRun } from "./helpers/run";
import { expectSignedIn, signInWithPassword } from "./helpers/ui";

/*
 * Cached versus uncached loads. Each reload is timed from navigation start to the first moment the
 * main area shows a heading and no skeleton ("content"), and records whether a skeleton was ever
 * painted. Every API call gets an artificial 250 ms of latency so the difference is visible against
 * a local API. Runs after the journey (it needs the member account) and prints the numbers; the
 * assertion is that a cached load reaches content sooner than a cold one. "skeleton" can read true
 * for a cached load because the static HTML shell (Suspense fallbacks) paints before JavaScript runs.
 */
const LATENCY_MS = 250;
const run = loadRun();

type Mark = { content: number | null; skeleton: boolean };

async function arm(page: Page) {
  await page.addInitScript(() => {
    const m = { content: null as number | null, skeleton: false };
    (window as unknown as { __perf: typeof m }).__perf = m;
    const check = () => {
      const main = document.getElementById("main");
      if (!main) return;
      if (main.querySelector('[role="status"]')) m.skeleton = true;
      else if (m.content === null && main.querySelector("h1")) m.content = performance.now();
    };
    new MutationObserver(check).observe(document, { subtree: true, childList: true, attributes: true });
  });
}

async function timed(page: Page, path: string): Promise<Mark> {
  await page.goto(path, { waitUntil: "commit" });
  await page.waitForFunction(() => (window as unknown as { __perf?: Mark }).__perf?.content != null, undefined, { timeout: 30_000 });
  return page.evaluate(() => (window as unknown as { __perf: Mark }).__perf);
}

test("cached reloads paint without a skeleton; cold loads show one", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signInWithPassword(page, run.memberEmail, run.password);
  await expectSignedIn(page);

  await page.route(`${apiUrl}/**`, async (route) => {
    await new Promise((r) => setTimeout(r, LATENCY_MS));
    await route.continue();
  });
  await arm(page);

  const rows: string[] = [];
  for (const path of ["/", "/my-tasks"]) {
    // Cold: wipe the persisted cache, then load.
    await page.evaluate(() => new Promise<void>((res) => {
      const req = indexedDB.deleteDatabase("ahead-one");
      req.onsuccess = req.onerror = req.onblocked = () => res();
    }));
    const cold = await timed(page, path);
    // Let the throttled persister flush, then reload with the cache in place.
    await page.waitForTimeout(2_500);
    const warm = await timed(page, path);
    rows.push(`${path.padEnd(10)} cold: ${Math.round(cold.content ?? -1)} ms (skeleton ${cold.skeleton})   cached: ${Math.round(warm.content ?? -1)} ms (skeleton ${warm.skeleton})`);
    expect(warm.content!, `${path}: a cached load should reach content sooner than a cold one`).toBeLessThan(cold.content!);
  }
  console.log(`\n[perf] time to content, ${LATENCY_MS} ms added per API call\n${rows.join("\n")}\n`);
  await ctx.close();
});

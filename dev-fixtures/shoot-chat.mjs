// DEV ONLY. Screenshots of the conversation view with read receipts on the messaging fixtures (/dev/messaging).
// Usage: node dev-fixtures/shoot-chat.mjs <outDir> [webUrl]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const out = process.argv[2];
const web = process.argv[3] ?? "http://localhost:3200";
mkdirSync(out, { recursive: true });
const cases = [
  { n: "dm", q: "view=conversation&c=aaaaaaa1-0000-4000-8000-000000000004" },
  { n: "channel", q: "view=conversation&c=aaaaaaa1-0000-4000-8000-000000000001&seen=1" },
];
const browser = await chromium.launch();
for (const c of cases) for (const s of [{ n: "desktop", w: 1440, h: 900 }, { n: "narrow", w: 390, h: 844 }]) for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
  const page = await ctx.newPage();
  await page.goto(`${web}/dev/messaging?${c.q}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  if (c.n === "channel") await page.getByRole("button", { name: /Seen by/ }).click().catch(() => console.log("no seen-by"));
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `chat-${c.n}-${s.n}-${theme}.png`) });
  await ctx.close();
}
await browser.close();

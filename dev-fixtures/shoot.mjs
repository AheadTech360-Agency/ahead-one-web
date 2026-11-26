// DEV ONLY. Renders each dashboard against typed fixtures (page.route mocks the API) and saves screenshots.
// Usage: node dev-fixtures/shoot.mjs <outDir> [webUrl]   (the web app must be running with NEXT_PUBLIC_API_URL=http://localhost:8099)
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { CLIENT_IDS, PROJECTS, WS, me, members, teamDashboard } from "./team.ts";

const out = process.argv[2];
const web = process.argv[3] ?? "http://localhost:3200";
const API = "http://localhost:8099";
mkdirSync(out, { recursive: true });

const cors = { "access-control-allow-origin": web, "access-control-allow-credentials": "true", "access-control-allow-headers": "*", "access-control-allow-methods": "*" };
const json = (route, body, status = 200) => route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(body) });

const cases = [
  { name: "owner-complete", role: "owner", who: "owner", path: "/" },
  { name: "owner-client", role: "owner", who: "owner", path: `/?client=${CLIENT_IDS.acme}` },
  { name: "admin-complete", role: "admin", who: "admin", path: "/" },
  { name: "admin-client", role: "admin", who: "admin", path: `/?client=${CLIENT_IDS.cedar}` },
  { name: "owner-project", role: "owner", who: "owner", path: `/?client=${CLIENT_IDS.acme}&project=${PROJECTS[1].project_id}` },
  { name: "admin-project", role: "admin", who: "admin", path: `/?client=${CLIENT_IDS.cedar}&project=${PROJECTS[0].project_id}` },
  { name: "owner-project-pick", role: "owner", who: "owner", path: `/?client=${CLIENT_IDS.acme}&project=${PROJECTS[1].project_id}`, act: "pick" },
  { name: "admin-scoped", role: "admin", who: "adminScoped", path: "/" },
  { name: "member", role: "member", who: "management", path: "/" },
  ...(process.env.EXTRA?.split(",") ?? []).filter(Boolean).map((p) => ({ name: `owner-${p.replace(/\W/g, "")}`, role: "owner", who: "owner", path: p })),
];
const only = process.env.ONLY?.split(",");
const sizes = [{ n: "desktop", w: 1440, h: 900 }, { n: "narrow", w: 390, h: 844 }].filter((x) => !process.env.SIZE || x.n === process.env.SIZE);
const themes = ["light", "dark"].filter((x) => !process.env.THEME || x === process.env.THEME);

const browser = await chromium.launch();
const unknown = new Set();
for (const c of cases) {
  if (only && !only.includes(c.name)) continue;
  for (const s of sizes) for (const theme of themes) {
    const ctx = await browser.newContext({ viewport: { width: s.w, height: s.h }, colorScheme: theme, deviceScaleFactor: 1 });
    await ctx.addCookies([{ name: "ahead_rt", value: "x", url: web }]);
    await ctx.addInitScript((t) => { try { localStorage.setItem("theme", t); } catch {} }, theme);
    const page = await ctx.newPage();
    await page.route("**/api/auth/session", (r) => json(r, { access_token: "fixture", expires_in: 900, aal: "aal2" }));
    await page.route(`${API}/**`, async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
      const url = new URL(req.url());
      const p = url.pathname;
      if (p === "/v1/me") return json(route, me(c.role));
      if (p.endsWith("/dashboard/team")) {
        if (c.role === "member") return json(route, { error: { code: "forbidden", message: "forbidden" } }, 403);
        const sp = url.searchParams.get("space_id") ?? undefined;
        return json(route, teamDashboard(c.who, sp, url.searchParams.get("project_id") ?? undefined));
      }
      if (p.endsWith("/dashboard")) return json(route, { kind: "personal", today: [], overdue: [], upcoming: [], mentions: [], activity: [] });
      if (p.endsWith("/members")) return json(route, members());
      if (p.endsWith("/clients") && p.includes("/members/")) return json(route, p.includes("0000000002") ? { all_clients: false, space_ids: [CLIENT_IDS.acme, CLIENT_IDS.cedar, CLIENT_IDS.fjord] } : { all_clients: true, space_ids: [] });
      if (p.endsWith("/audit-log")) return json(route, { items: [
        { id: "x1", actor: members()[0].user, action: "member.role_changed", target_type: "user", target_id: "u", before: { role: "member" }, after: { role: "management" }, ip: null, created_at: new Date(Date.now() - 3600e3).toISOString() },
        { id: "x2", actor: members()[0].user, action: "member.client_access_changed", target_type: "user", target_id: "u", before: null, after: null, ip: null, created_at: new Date(Date.now() - 86400e3).toISOString() },
        { id: "x3", actor: members()[1].user, action: "invite.created", target_type: "invite", target_id: null, before: null, after: null, ip: null, created_at: new Date(Date.now() - 90000e3).toISOString() },
      ], next_cursor: null });
      if (p.endsWith("/tree")) return json(route, Object.values(CLIENT_IDS).map((id, i) => ({ id, name: ["Acme Logistics", "Birchwood Dental", "Cedar & Finch", "Delta Ridge Capital", "Ember Coffee Roasters", "Fjord Outdoors"][i], color: ["#2e5597", "#1f9a63", "#c4650a", "#7b4fb8", "#b8324a", "#0f8aa3"][i], archived: false, projects: [] })));
      if (p.endsWith("/unread-count")) return json(route, { count: 0 });
      if (p.endsWith("/files/summary")) return json(route, { count: 0, total_bytes: 0, expiring_soon: 0 });
      if (p.endsWith("/conversations") || p.includes("/notifications") || p.endsWith("/invites")) return json(route, []);
      unknown.add(p);
      return json(route, []);
    });
    await page.goto(web + c.path, { waitUntil: "networkidle" });
    await page.waitForSelector(c.path.startsWith("/settings") ? "text=What each role can do" : c.role === "member" ? "h1" : "text=Who is assigned what", { timeout: 60000 }).catch(() => console.log("timeout", c.name, s.n, theme));
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(700);
    // The app scrolls inside its sheet: grow the viewport to the content so one image shows everything.
    const sh = await page.evaluate(() => Math.max(...[...document.querySelectorAll("*")].map((e) => (e.scrollHeight > e.clientHeight + 20 && getComputedStyle(e).overflowY !== "visible" ? e.scrollHeight : 0)), 0));
    if (sh > s.h) { await page.setViewportSize({ width: s.w, height: Math.min(sh + 70, 5000) }); await page.waitForTimeout(500); }
    if (process.env.ACT && c.path === "/settings/members") {
      if (process.env.ACT === "role") { await page.getByRole("button", { name: /Actions for Bilal/ }).click(); await page.getByRole("menuitem", { name: "Change role" }).click(); await page.getByRole("radio", { name: /Admin/ }).click(); }
      if (process.env.ACT === "access") { await page.getByRole("button", { name: /Client access for Omar/ }).click(); await page.getByRole("switch").click(); await page.getByRole("dialog").getByLabel("Acme Logistics").click(); }
      await page.waitForTimeout(400);
    }
    if (c.act === "pick") { await page.getByRole("button", { name: "Choose a project" }).click(); await page.waitForTimeout(300); }
    await page.screenshot({ path: join(out, `${c.name}-${s.n}-${theme}${process.env.ACT ? "-" + process.env.ACT : ""}.png`) });
    await ctx.close();
  }
}
await browser.close();
if (unknown.size) console.log("unmocked:", [...unknown].join(" "));

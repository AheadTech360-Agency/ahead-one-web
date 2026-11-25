# ahead-one-web

Next.js (App Router, TypeScript, Tailwind) web app for the AheadTech360 internal task manager. Sibling repos: `ahead-one-api` (Rust API, the source of truth for types and the API contract in `docs/api-contract.md`) and `ahead-one-mobile` (Expo).

## Layout

```
src/app/(auth)       login (password + emailed code), forgot/reset password, invite acceptance
src/app/(app)        the signed-in app: Home, My Tasks, projects/lists/tasks, messages, inbox, settings
src/app/api/auth     backend-for-frontend routes: hold the refresh token in an httpOnly cookie
src/lib/auth         in-memory access token, refresh, sign out
src/lib/api          API client, query keys, hooks; generated/ holds the API's types (never edit by hand)
src/ui               design system (tokens in src/styles/tokens.css); platform-level building blocks
src/features/*       tasks, messages, files (Files page, player), recorder (screen recorder), notifications, push, realtime (WebSocket)
src/lib/files        pure upload limits, recording caps and Files query logic (unit tested with `npm test`)
src/components       app shell (sidebar, top bar, command palette), auth widgets
```

The design system and app shell are kept separate from feature code so a future internal tool (the CRM) can reuse them.

## Rules

- API types come only from `src/lib/api/generated` (via `@/lib/api/types`). When the API changes: in `ahead-one-api` run `cargo test` and `node scripts/gen-index.mjs`, then here `npm run sync-types`.
- The refresh token never reaches JavaScript: only the Next.js route handlers in `src/app/api/auth` read the cookie. The access token lives in memory.
- Nothing secret in this repo or in `NEXT_PUBLIC_*` variables.
- UI copy never uses em dashes. Every list has an empty state and a loading skeleton.

## Run

```
cp .env.example .env.local     # set NEXT_PUBLIC_API_URL (the API must be running, see its CLAUDE.md)
npm install
npm run dev                    # http://localhost:3000 ; component gallery at /dev/components
```

## Check

```
npx tsc --noEmit && npm test && npm run lint && npm run build
npm audit --omit=dev
```

CI (`.github/workflows/ci.yml`) runs the same on every PR.

## Deploy (Vercel)

- Import the repo in Vercel (framework: Next.js; no custom build settings).
- Environment variables: `NEXT_PUBLIC_API_URL=https://<service>.up.railway.app` (the API's Railway public domain), `BFF_SECRET` (the same value as on the API; server-side only), optionally `API_INTERNAL_URL`, and the `NEXT_PUBLIC_FIREBASE_*` values for web push.
- Domain `portal.aheadtech360.com` through Cloudflare DNS (CNAME to Vercel). The API's `WEB_ORIGIN` must be exactly this origin. The refresh cookie is set by this app's own `/api/auth` routes on the portal host (`__Host-`, host-only), and the browser calls the API with a bearer token and no cookies, so the API can live on any hostname (it uses Railway's public domain).

## End-to-end tests

Playwright (Chromium) drives the whole product journey against a real API: invite, sign-in with the emailed code, project, task, @mention, live notification, DM.

```
npm run e2e         # headless; npm run e2e:ui for the UI runner
```

`e2e/global-setup.ts` starts the API binary (emails are logged to `e2e/.state/api.log`, where the helpers read sign-in codes and invite links) and the web app (`next build` into `.next-e2e`, then `next start`), creates a fresh workspace with unique `e2e-<ts>-*@dev.test` emails, and stops what it started. The API runs with `APP_ENV=development`, `EMAIL_LOG_BODIES=1`, no SMTP, Redis or FCM.

Env knobs: `E2E_API_BIN` (default `D:/ahead-one/.target-test/debug/tasks-api.exe`; build with `cargo build -p server` in the API repo), `E2E_API_DIR` (default `../ahead-one-api`, where its `.env` is loaded), `E2E_API_PORT` (8091), `E2E_WEB_PORT` (3100), `E2E_REUSE=1` (use servers already listening), `E2E_SKIP_BUILD=1` (reuse the last `.next-e2e` build).

`e2e/recordings.spec.ts` drives the screen recorder with Chromium's fake capture flags. Saving and playback need the API's object storage (R2) configured and reachable from the browser (bucket CORS); when it is not, that part skips with a note.

CI runs the `e2e` job only when the repository variable `E2E_ENABLED` is `true`. It needs the secret `API_REPO_TOKEN` (a token that can read `AheadTech360-Agency/ahead-one-api`), builds the API against a Postgres 16 service and uploads `playwright-report` on failure.

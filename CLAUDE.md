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
src/features/*       tasks, messages, notifications, push, realtime (WebSocket)
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
npx tsc --noEmit && npm run lint && npm run build
npm audit --omit=dev
```

CI (`.github/workflows/ci.yml`) runs the same on every PR.

## Deploy (Vercel)

- Import the repo in Vercel (framework: Next.js; no custom build settings).
- Environment variables: `NEXT_PUBLIC_API_URL=https://api.tasks.aheadtech360.com`, optionally `API_INTERNAL_URL`, and the `NEXT_PUBLIC_FIREBASE_*` values for web push.
- Domain `tasks.aheadtech360.com` through Cloudflare DNS (CNAME to Vercel). The API's `WEB_ORIGIN` must be exactly this origin, and the API hostname must be a sibling under the same site so the auth cookie works (`__Host-` cookies are host-only and first-party).

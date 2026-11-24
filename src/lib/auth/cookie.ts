/*
 * The refresh-token cookie. Shared by the route handlers (which set it) and proxy.ts (which only
 * checks that it exists). `__Host-` requires Secure, so it is used in production only; plain
 * http://localhost in development gets `ahead_rt` without Secure.
 */
export const IS_PROD = process.env.NODE_ENV === "production";
export const REFRESH_COOKIE = IS_PROD ? "__Host-ahead_rt" : "ahead_rt";
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;

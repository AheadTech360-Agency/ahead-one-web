import { e2eConfig, webUrl } from "./config";

/**
 * Environment for the API process. Locally the API loads its own .env (Neon dev database, JWT secret) from
 * E2E_API_DIR; dotenv never overrides variables that are already set, so everything below wins.
 * In CI there is no .env, so DATABASE_URL_UNPOOLED and AUTH_JWT_SECRET must come from the environment;
 * every other required variable is set here explicitly.
 */
export function apiEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    APP_ENV: "development",
    PORT: String(e2eConfig.apiPort),
    WEB_ORIGIN: webUrl,
    RUN_JOBS: "false",
    // Needed to scrape sign-in codes and invite links from the log; the API refuses it in production.
    EMAIL_LOG_BODIES: "1",
    // Empty strings (not unset) so values from a local .env are not picked up: no real email, push or Redis.
    SMTP_HOST: "",
    FCM_SERVICE_ACCOUNT_JSON: "",
    REDIS_URL: "",
    RUST_LOG: process.env.E2E_API_RUST_LOG || "info,sqlx=warn",
    NO_COLOR: "1",
  };
  if (env.DATABASE_URL_UNPOOLED && !env.DATABASE_URL) env.DATABASE_URL = env.DATABASE_URL_UNPOOLED;
  return env;
}

import path from "node:path";

const webRoot = path.resolve(__dirname, "..", "..");

/** Every knob the suite reads from the environment, with local defaults. */
export const e2eConfig = {
  webRoot,
  apiBin: process.env.E2E_API_BIN || "D:/ahead-one/.target-test/debug/tasks-api.exe",
  apiDir: path.resolve(webRoot, process.env.E2E_API_DIR || "../ahead-one-api"),
  apiPort: Number(process.env.E2E_API_PORT || 8091),
  webPort: Number(process.env.E2E_WEB_PORT || 3100),
  /** E2E_REUSE=1: use servers that are already listening instead of starting (and stopping) our own. */
  reuse: process.env.E2E_REUSE === "1",
  /** Where the API's stdout/stderr (emails are logged there in development) is written and scraped. */
  stateDir: path.join(webRoot, "e2e", ".state"),
  /** Next build output for the suite; separate from .next so a dev server or normal build is never disturbed. */
  distDir: ".next-e2e",
};

export const apiUrl = `http://localhost:${e2eConfig.apiPort}`;
export const webUrl = `http://localhost:${e2eConfig.webPort}`;
export const apiLogFile = process.env.E2E_API_LOG || path.join(e2eConfig.stateDir, "api.log");
export const runFile = path.join(e2eConfig.stateDir, "run.json");
export const sharedFile = path.join(e2eConfig.stateDir, "shared.json");

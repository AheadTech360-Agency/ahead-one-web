import fs from "node:fs";
import path from "node:path";
import { apiEnv } from "./helpers/api";
import { apiLogFile, apiUrl, e2eConfig, runFile, sharedFile, webUrl } from "./helpers/config";
import { isUp, portInUse, runToCompletion, spawnLogged, type Started, waitUntilUp } from "./helpers/processes";

/*
 * Starts the Rust API and the Next.js app (unless E2E_REUSE=1 and they already answer), creates a fresh
 * workspace with an Owner invite, and writes the run details for the specs. Returns the teardown that stops
 * only what this run started.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  const { stateDir, apiBin, apiDir, apiPort, webPort, webRoot, reuse, distDir } = e2eConfig;
  fs.mkdirSync(stateDir, { recursive: true });
  fs.rmSync(sharedFile, { force: true });

  const started: Started[] = [];
  const teardown = async () => {
    for (const s of started.reverse()) s.stop();
  };

  try {
    // API
    const apiRunning = await isUp(`${apiUrl}/health`);
    if (apiRunning && !reuse) throw new Error(`Port ${apiPort} already serves an API. Stop it, pick E2E_API_PORT, or set E2E_REUSE=1.`);
    if (!apiRunning) {
      if (!fs.existsSync(apiBin)) throw new Error(`API binary not found at ${apiBin}. Build it or set E2E_API_BIN.`);
      fs.writeFileSync(apiLogFile, "");
      const api = spawnLogged(apiBin, [], { cwd: apiDir, env: apiEnv(), logFile: apiLogFile });
      started.push(api);
      await waitUntilUp(`${apiUrl}/health`, 90_000, api.child);
    }

    // Web
    const webRunning = await isUp(`${webUrl}/login`);
    if (webRunning && !reuse) throw new Error(`Port ${webPort} already serves a web app. Stop it, pick E2E_WEB_PORT, or set E2E_REUSE=1.`);
    if (!webRunning) {
      if (await portInUse(webPort)) throw new Error(`Port ${webPort} is taken by something that is not the web app.`);
      const webEnv = {
        ...process.env,
        NEXT_PUBLIC_API_URL: apiUrl,
        NEXT_DIST_DIR: distDir,
        NEXT_TELEMETRY_DISABLED: "1",
      };
      const webLog = path.join(stateDir, "web.log");
      fs.writeFileSync(webLog, "");
      if (process.env.E2E_SKIP_BUILD !== "1") {
        const build = runToCompletion("npx", ["next", "build"], { cwd: webRoot, env: webEnv, shell: true, timeoutMs: 600_000 });
        fs.appendFileSync(webLog, build.stdout + build.stderr);
        if (build.code !== 0) throw new Error(`next build failed (see ${webLog}):\n${(build.stdout + build.stderr).slice(-1500)}`);
      }
      const web = spawnLogged("npx", ["next", "start", "-p", String(webPort)], { cwd: webRoot, env: webEnv, logFile: webLog, shell: true });
      started.push(web);
      await waitUntilUp(`${webUrl}/login`, 60_000, web.child);
    }

    // Fresh workspace and Owner invite, unique per run so the shared dev database never collides.
    const ts = Date.now().toString(36);
    const run = {
      ts,
      slug: `e2e-${ts}`,
      workspace: `E2E ${ts}`,
      ownerEmail: `e2e-${ts}-owner@dev.test`,
      memberEmail: `e2e-${ts}-member@dev.test`,
      ownerName: "Olivia Owner",
      memberName: "Mia Member",
      password: `E2e-pass-${ts}-Zq9!`,
      inviteLink: "",
    };
    const boot = runToCompletion(
      apiBin,
      ["bootstrap-owner", "--email", run.ownerEmail, "--workspace", run.workspace, "--slug", run.slug],
      { cwd: apiDir, env: apiEnv() },
    );
    const link = /(https?:\/\/\S+\/invite\/[A-Za-z0-9_-]+)/.exec(boot.stdout)?.[1];
    if (!link) throw new Error(`bootstrap-owner printed no invite link (exit ${boot.code}):\n${boot.stdout}\n${boot.stderr.slice(-1500)}`);
    run.inviteLink = link;
    fs.writeFileSync(runFile, JSON.stringify(run, null, 2));
  } catch (err) {
    await teardown();
    throw err;
  }
  return teardown;
}

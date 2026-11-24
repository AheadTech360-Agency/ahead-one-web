import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(3000), redirect: "manual" });
    return res.status > 0;
  } catch {
    return false;
  }
}

export function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
  });
}

export async function waitUntilUp(url: string, timeoutMs: number, child?: ChildProcess): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) throw new Error(`Process for ${url} exited with code ${child.exitCode} before it was ready`);
    if (await isUp(url)) return;
    await sleep(500);
  }
  throw new Error(`${url} did not come up within ${timeoutMs}ms`);
}

export interface Started {
  child: ChildProcess;
  stop: () => void;
}

/** Spawns a long-running process with stdout and stderr appended to `logFile`. */
export function spawnLogged(
  command: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; logFile: string; shell?: boolean },
): Started {
  const fd = fs.openSync(opts.logFile, "a");
  const child = spawn(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    stdio: ["ignore", fd, fd],
    shell: opts.shell,
    windowsHide: true,
    detached: process.platform !== "win32",
  });
  child.on("error", (e) => fs.writeSync(fd, `spawn error: ${String(e)}\n`));
  return { child, stop: () => killTree(child) };
}

/** Kills the process and everything it spawned (npx/next start a child of their own). */
export function killTree(child: ChildProcess): void {
  if (!child.pid || child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  }
}

/** Runs a command to completion and returns its stdout. */
export function runToCompletion(
  command: string,
  args: string[],
  opts: { cwd: string; env: NodeJS.ProcessEnv; shell?: boolean; timeoutMs?: number },
): { code: number | null; stdout: string; stderr: string } {
  const r = spawnSync(command, args, {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    shell: opts.shell,
    timeout: opts.timeoutMs ?? 120_000,
    windowsHide: true,
  });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

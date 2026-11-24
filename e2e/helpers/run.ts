import fs from "node:fs";
import { runFile, sharedFile } from "./config";

export interface RunInfo {
  ts: string;
  slug: string;
  workspace: string;
  ownerEmail: string;
  memberEmail: string;
  ownerName: string;
  memberName: string;
  password: string;
  inviteLink: string;
}

export function loadRun(): RunInfo {
  return JSON.parse(fs.readFileSync(runFile, "utf8")) as RunInfo;
}

/** Small key/value store so separate spec files in one run can hand data to each other. */
export function readShared<T>(key: string): T | undefined {
  try {
    return (JSON.parse(fs.readFileSync(sharedFile, "utf8")) as Record<string, T>)[key];
  } catch {
    return undefined;
  }
}

export function writeShared(key: string, value: unknown): void {
  let all: Record<string, unknown> = {};
  try {
    all = JSON.parse(fs.readFileSync(sharedFile, "utf8")) as Record<string, unknown>;
  } catch {
    /* first write */
  }
  all[key] = value;
  fs.writeFileSync(sharedFile, JSON.stringify(all, null, 2));
}

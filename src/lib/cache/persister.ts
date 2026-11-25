"use client";

import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { cacheBuster, PERSIST_THROTTLE_MS, restorableRecord, type PersistedRecord } from "./policy";

/*
 * IndexedDB persister for the TanStack Query cache. One record, owned by one signed-in user:
 * - writes are throttled (trailing) and flushed when the tab is hidden;
 * - nothing is written until `/v1/me` has named the user (`bindPersistUser`);
 * - `wipePersistedCache()` deletes the record and blocks writes until the next bind, so sign-out
 *   and a user switch cannot leave the previous person's data behind.
 * Any IndexedDB failure (private mode, quota, blocked storage) degrades to "no persistence".
 */

const KEY = "client";
const DB = "ahead-one";
const STORE = "query-cache";

export const BUSTER = cacheBuster(process.env.NEXT_PUBLIC_APP_BUILD);

let store: UseStore | null = null;
function db(): UseStore | null {
  if (typeof indexedDB === "undefined") return null;
  try {
    store ??= createStore(DB, STORE);
  } catch {
    store = null;
  }
  return store;
}

let boundUser: string | null = null;
/** The user the restored record belonged to, null when nothing was restored. */
let restoredUser: string | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let pending: PersistedClient | null = null;

export function getRestoredUserId() {
  return restoredUser;
}

/** `/v1/me` named the signed-in user: from now on the cache is theirs and may be written. */
export function bindPersistUser(userId: string) {
  boundUser = userId;
  restoredUser = userId;
}

async function write(client: PersistedClient) {
  const s = db();
  if (!s || !boundUser) return;
  const record: PersistedRecord<PersistedClient> = {
    userId: boundUser,
    buster: BUSTER,
    timestamp: Date.now(),
    client,
  };
  try {
    await set(KEY, record, s);
  } catch {
    // Quota or a blocked database: the app keeps working from memory.
  }
}

function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const client = pending;
  pending = null;
  if (client) void write(client);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => document.visibilityState === "hidden" && flush());
  window.addEventListener("pagehide", flush);
}

/** Delete the stored cache and refuse writes until the next `bindPersistUser`. */
export async function wipePersistedCache() {
  boundUser = null;
  restoredUser = null;
  pending = null;
  if (timer) clearTimeout(timer);
  timer = null;
  const s = db();
  if (!s) return;
  try {
    await del(KEY, s);
  } catch {
    // Nothing to do: the record is rewritten (and owned) on the next sign-in anyway.
  }
}

export function createQueryPersister(): Persister {
  return {
    persistClient(client) {
      if (!boundUser || !db()) return;
      pending = client;
      timer ??= setTimeout(flush, PERSIST_THROTTLE_MS);
    },
    async restoreClient() {
      const s = db();
      if (!s) return undefined;
      try {
        const raw = await get(KEY, s);
        const rec = restorableRecord<PersistedClient>(raw, { buster: BUSTER });
        if (!rec) {
          if (raw !== undefined) void del(KEY, s).catch(() => undefined);
          return undefined;
        }
        restoredUser = rec.userId;
        return rec.client;
      } catch {
        return undefined;
      }
    },
    async removeClient() {
      await wipePersistedCache();
    },
  };
}

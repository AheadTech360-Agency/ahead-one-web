"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const listeners = new Map<string, Set<() => void>>();

function emit(key: string) {
  listeners.get(key)?.forEach((l) => l());
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Per-viewer UI preference in localStorage (sidebar collapsed, expanded tree nodes).
 * Survives blocked storage by falling back to the initial value. Never use for data.
 */
export function useStoredState<T>(key: string, initial: T) {
  const subscribe = useCallback(
    (fn: () => void) => {
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      set.add(fn);
      const onStorage = (e: StorageEvent) => e.key === key && fn();
      window.addEventListener("storage", onStorage);
      return () => {
        set.delete(fn);
        window.removeEventListener("storage", onStorage);
      };
    },
    [key],
  );

  const raw = useSyncExternalStore(subscribe, () => read(key), () => null);

  const value = useMemo<T>(() => {
    if (raw === null) return initial;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return initial;
    }
    // `initial` is a default, not a dependency: callers pass literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prevRaw = read(key);
      let prev: T = initial;
      if (prevRaw !== null) {
        try {
          prev = JSON.parse(prevRaw) as T;
        } catch {
          prev = initial;
        }
      }
      const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Storage blocked; nothing to persist.
      }
      emit(key);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  return [value, setValue] as const;
}

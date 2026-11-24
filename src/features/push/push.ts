"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";
import type { RegisterPushToken, RemovePushToken } from "@/lib/api/types";

/*
 * Web push through Firebase Cloud Messaging. Active only when every NEXT_PUBLIC_FIREBASE_* value
 * is set. Permission is requested only from a user action (settings switch or the dismissible
 * prompt); nothing here runs on page load except a silent token refresh when push is already on.
 *
 * The service worker is served by src/app/firebase-messaging-sw.js/route.ts. It shows the
 * notification itself (no Firebase SDK inside the worker) and opens the `link` on click.
 */

export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
};
const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? "";

export const isPushConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId && vapidKey,
);

const SW_URL = "/firebase-messaging-sw.js";
// Firebase's own default scope: keeps the worker away from page navigation.
const SW_SCOPE = "/firebase-cloud-messaging-push-scope";
const TOKEN_KEY = "ahead-one.push-token";
const DISMISS_KEY = "ahead-one.push-prompt-dismissed";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/* ---------- local state (per browser) ---------- */

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function read(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage blocked: push still works for this session.
  }
  emit();
}

export type PushState = {
  available: boolean;
  permission: NotificationPermission | "unsupported";
  enabled: boolean;
  dismissed: boolean;
};

let cached: PushState | null = null;
function snapshot(): PushState {
  const available = isPushConfigured && isPushSupported();
  const next: PushState = {
    available,
    permission: available ? Notification.permission : "unsupported",
    enabled: available && Notification.permission === "granted" && Boolean(read(TOKEN_KEY)),
    dismissed: read(DISMISS_KEY) === "1",
  };
  if (
    cached &&
    cached.available === next.available &&
    cached.permission === next.permission &&
    cached.enabled === next.enabled &&
    cached.dismissed === next.dismissed
  ) {
    return cached;
  }
  cached = next;
  return next;
}
const SERVER: PushState = { available: false, permission: "unsupported", enabled: false, dismissed: true };

function subscribe(fn: () => void) {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  window.addEventListener("focus", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
    window.removeEventListener("focus", fn);
  };
}

export function usePushState() {
  return useSyncExternalStore(subscribe, snapshot, () => SERVER);
}

export function dismissPushPrompt() {
  write(DISMISS_KEY, "1");
}

/* ---------- Firebase ---------- */

async function messaging() {
  const [{ initializeApp, getApps }, fm] = await Promise.all([import("@firebase/app"), import("@firebase/messaging")]);
  if (!(await fm.isSupported())) throw new Error("This browser can't receive push notifications.");
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  return { m: fm.getMessaging(app), fm };
}

async function registration() {
  return navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
}

async function fetchToken() {
  const { m, fm } = await messaging();
  const reg = await registration();
  return fm.getToken(m, { vapidKey, serviceWorkerRegistration: reg });
}

async function register(token: string) {
  const body: RegisterPushToken = { token, platform: "web" };
  await api<void>("/v1/push-tokens", { method: "POST", body });
  write(TOKEN_KEY, token);
}

/**
 * Turn push on. Call straight from a click handler: the permission prompt must follow a user
 * gesture. Resolves with the resulting permission.
 */
export async function enablePush(): Promise<NotificationPermission> {
  if (!isPushConfigured || !isPushSupported()) return "denied";
  const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
  emit();
  if (permission !== "granted") return permission;
  const token = await fetchToken();
  if (!token) throw new Error("Couldn't get a push token from the browser.");
  await register(token);
  write(DISMISS_KEY, "1");
  return permission;
}

/** Turn push off for this browser: forget the token here and on the server. */
export async function disablePush() {
  const token = read(TOKEN_KEY);
  write(TOKEN_KEY, null);
  if (!token) return;
  const body: RemovePushToken = { token };
  await Promise.allSettled([
    api<void>("/v1/push-tokens", { method: "DELETE", body }),
    messaging().then(({ m, fm }) => fm.deleteToken(m)),
  ]);
}

/** Sign-out: drop this browser's token while the session can still authorise the DELETE. */
export async function unregisterPushOnSignOut() {
  if (!read(TOKEN_KEY)) return;
  try {
    await disablePush();
  } catch {
    // Signing out wins; a stale token is removed by the server when FCM reports it unregistered.
  }
}

/**
 * Push already on: FCM rotates tokens, so refresh silently (no prompt; permission is granted)
 * and re-register when it changed.
 */
export async function refreshPushToken() {
  if (!isPushConfigured || !isPushSupported() || Notification.permission !== "granted") return;
  const stored = read(TOKEN_KEY);
  if (!stored) return;
  try {
    const token = await fetchToken();
    if (token && token !== stored) await register(token);
  } catch {
    // Try again next session.
  }
}

"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useMe } from "@/lib/api/hooks";
import type { MeResponse, Membership, Role } from "@/lib/api/types";

const STORAGE_KEY = "ahead-one.workspace";

type WorkspaceState = {
  me: MeResponse | undefined;
  meStatus: "pending" | "error" | "success";
  meError: unknown;
  memberships: Membership[];
  current: Membership | undefined;
  workspaceId: string | undefined;
  role: Role | undefined;
  setWorkspaceId: (id: string) => void;
  refetchMe: () => void;
};

const Ctx = createContext<WorkspaceState | null>(null);

const listeners = new Set<() => void>();
function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (e: StorageEvent) => e.key === STORAGE_KEY && fn();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}
function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const me = useMe();
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  const memberships = useMemo(() => me.data?.memberships ?? [], [me.data]);
  const current = memberships.find((m) => m.workspace.id === stored) ?? memberships[0];

  const setWorkspaceId = useCallback((id: string) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Storage blocked: selection lasts for this tab only.
    }
    listeners.forEach((l) => l());
  }, []);

  const value: WorkspaceState = {
    me: me.data,
    meStatus: me.status,
    meError: me.error,
    memberships,
    current,
    workspaceId: current?.workspace.id,
    role: current?.role,
    setWorkspaceId,
    refetchMe: () => void me.refetch(),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useWorkspace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return v;
}

const RANK: Record<Role, number> = { owner: 4, admin: 3, management: 2, member: 1, guest: 0 };
export function roleAtLeast(role: Role | undefined, min: Role) {
  return role !== undefined && RANK[role] >= RANK[min];
}

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  management: "Management",
  member: "Member",
  guest: "Guest",
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  owner: "Full control, including billing and other admins",
  admin: "Manages members, invites and workspace settings",
  management: "Creates spaces and projects, sees team workload",
  member: "Works on projects they're added to",
  guest: "Sees only the projects shared with them",
};

export const ROLES: Role[] = ["owner", "admin", "management", "member", "guest"];

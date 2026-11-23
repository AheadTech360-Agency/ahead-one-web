/*
 * TanStack Query key factory. Keys are hierarchical so a whole area can be invalidated
 * with its prefix, for example `qk.workspace(ws).all`.
 */

export const qk = {
  me: () => ["me"] as const,
  roles: () => ["roles"] as const,
  invitePreview: (token: string) => ["invite-preview", token] as const,
  notifications: {
    all: ["notifications"] as const,
    list: (unreadOnly: boolean) => ["notifications", "list", { unreadOnly }] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    prefs: () => ["notifications", "prefs"] as const,
  },
  workspace: (ws: string) => ({
    all: ["ws", ws] as const,
    members: () => ["ws", ws, "members"] as const,
    invites: () => ["ws", ws, "invites"] as const,
    auditLog: (filters: { action?: string; actor?: string }) =>
      ["ws", ws, "audit-log", filters] as const,
    tree: (includeArchived = false) => ["ws", ws, "tree", { includeArchived }] as const,
    conversations: () => ["ws", ws, "conversations"] as const,
    dashboard: () => ["ws", ws, "dashboard"] as const,
    myTasks: (bucket: string) => ["ws", ws, "my-tasks", bucket] as const,
    search: (q: string) => ["ws", ws, "search", q] as const,
  }),
};

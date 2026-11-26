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
    channels: () => ["notifications", "channels"] as const,
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
    /** Owner, Admin and Management dashboard; `space` is the client (a space id) or "all". */
    teamDashboard: (space: string | undefined) => ["ws", ws, "team-dashboard", space ?? "all"] as const,
    /** Owner only, never persisted: which clients an Admin can see. */
    memberClients: (userId: string) => ["ws", ws, "member-clients", userId] as const,
    myTasks: (bucket: string) => ["ws", ws, "my-tasks", bucket] as const,
    search: (q: string) => ["ws", ws, "search", q] as const,
    filesAll: () => ["ws", ws, "files"] as const,
    files: (filters: object) => ["ws", ws, "files", "list", filters] as const,
    filesSummary: () => ["ws", ws, "files", "summary"] as const,
    /** Never persisted (see lib/cache/policy.ts). The download key carries a signed URL. */
    appRelease: () => ["ws", ws, "app-release", "android"] as const,
    appReleaseDownload: () => ["ws", ws, "app-release", "android", "download"] as const,
  }),
};

/*
 * Messaging keys. Per-conversation data lives under ["chat", id] so a reconnect can refresh it
 * all with one prefix; the conversation list stays under the workspace (qk.workspace(ws).conversations()).
 */
export const chatKeys = {
  all: ["chat"] as const,
  conversation: (id: string) => ["chat", id, "detail"] as const,
  messages: (id: string) => ["chat", id, "messages"] as const,
  readStates: (id: string) => ["chat", id, "read-states"] as const,
  members: (id: string) => ["chat", id, "members"] as const,
  attachmentUrl: (id: string) => ["chat", "attachment-url", id] as const,
  browse: (ws: string) => ["ws", ws, "channels-browse"] as const,
};

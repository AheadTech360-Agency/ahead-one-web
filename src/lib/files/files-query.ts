/* Files page filters: URL params in, API query out. Pure, unit tested. */

export type FileTypeFilter = "image" | "video" | "audio" | "document" | "other";
export type FileSourceFilter = "tasks" | "chats" | "recordings";

export type FileFilters = {
  q: string;
  type: FileTypeFilter | "";
  source: FileSourceFilter | "";
  uploader: string;
  conversationId?: string;
  projectId?: string;
};

export const FILE_PAGE = 40;
export const TYPES: FileTypeFilter[] = ["image", "video", "audio", "document", "other"];
export const SOURCES: FileSourceFilter[] = ["tasks", "chats", "recordings"];

export const EMPTY_FILTERS: FileFilters = { q: "", type: "", source: "", uploader: "" };

type Params = { get(name: string): string | null };

export function filtersFromParams(p: Params): FileFilters {
  const type = p.get("type") ?? "";
  const source = p.get("source") ?? "";
  const uploader = p.get("uploader") ?? "";
  return {
    q: (p.get("q") ?? "").slice(0, 100),
    type: (TYPES as string[]).includes(type) ? (type as FileTypeFilter) : "",
    source: (SOURCES as string[]).includes(source) ? (source as FileSourceFilter) : "",
    uploader: /^[0-9a-f-]{36}$/i.test(uploader) ? uploader : "",
  };
}

/** Query string for the page URL: only the filters that are set. */
export function paramsFromFilters(f: FileFilters): string {
  const sp = new URLSearchParams();
  if (f.q.trim()) sp.set("q", f.q.trim());
  if (f.type) sp.set("type", f.type);
  if (f.source) sp.set("source", f.source);
  if (f.uploader) sp.set("uploader", f.uploader);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Query object for GET /files. Empty values are omitted; `cursor` is the last id of the previous page. */
export function buildFilesQuery(f: FileFilters, cursor?: string, limit = FILE_PAGE) {
  return {
    q: f.q.trim() || undefined,
    type: f.type || undefined,
    source: f.source || undefined,
    uploader: f.uploader || undefined,
    conversation_id: f.conversationId || undefined,
    project_id: f.projectId || undefined,
    cursor: cursor || undefined,
    limit,
  };
}

/** Whether a search, type or uploader filter is set (the source tabs don't count). */
export function hasActiveFilters(f: FileFilters): boolean {
  return Boolean(f.q.trim() || f.type || f.uploader);
}

/** Next cursor: the last id of a full page, or undefined when the list has ended. */
export function nextCursor<T>(page: T[], idOf: (item: T) => string, limit = FILE_PAGE): string | undefined {
  return page.length >= limit ? idOf(page[page.length - 1]) : undefined;
}

export const EXPIRY_WARN_DAYS = 14;

/** Whole days until a file is deleted (0 when due today or past). */
export function daysUntil(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 86_400_000));
}

export function expiryState(expiresAt: string, now: number): { days: number; soon: boolean } {
  const days = daysUntil(expiresAt, now);
  return { days, soon: days <= EXPIRY_WARN_DAYS };
}

export function expiryLabel(days: number): string {
  if (days <= 0) return "Expires today";
  if (days === 1) return "Expires tomorrow";
  return `Expires in ${days} days`;
}

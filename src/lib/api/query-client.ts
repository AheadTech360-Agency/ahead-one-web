import { QueryCache, QueryClient } from "@tanstack/react-query";
import { classifyFailure, emitRefreshFailure } from "@/lib/cache/refresh-errors";
import { GC_TIME } from "@/lib/cache/stale";
import { isApiError } from "./client";

const NO_RETRY_STATUSES = new Set([0, 401, 403, 404, 409, 422]);

export function makeQueryClient() {
  return new QueryClient({
    // One mechanism for every screen: a failed fetch over cached data keeps the data and raises a
    // single de-duplicated notice (RefreshFailureNotice). With no cached data the screen's own
    // inline error state with Retry takes over.
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (typeof window === "undefined") return;
        const kind = classifyFailure({
          hasData: query.state.data !== undefined,
          online: navigator.onLine !== false,
          status: isApiError(error) ? error.status : undefined,
          code: isApiError(error) ? error.code : undefined,
        });
        if (kind) emitRefreshFailure(kind);
      },
    }),
    defaultOptions: {
      queries: {
        // Per-resource values live next to each hook (see lib/cache/stale.ts); this is the fallback.
        staleTime: 30_000,
        gcTime: GC_TIME,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        retry: (count, error) => {
          if (isApiError(error) && NO_RETRY_STATUSES.has(error.status)) return false;
          if (isApiError(error) && error.code === "not_configured") return false;
          return count < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

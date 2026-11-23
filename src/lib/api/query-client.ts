import { QueryClient } from "@tanstack/react-query";
import { isApiError } from "./client";

const NO_RETRY_STATUSES = new Set([0, 401, 403, 404, 409, 422]);

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
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

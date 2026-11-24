import type { ApiErrorBody, KnownErrorCode } from "./types";

/** A failed API call, carrying the contract's error code. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: KnownErrorCode | "network" | "not_configured" | "unknown";

  constructor(status: number, code: ApiRequestError["code"], message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }

  get isNotFound() {
    return this.status === 404;
  }
}

export function isApiError(e: unknown): e is ApiRequestError {
  return e instanceof ApiRequestError;
}

/** Plain-language message for an error, suitable for UI copy. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Try again."): string {
  if (isApiError(e)) {
    switch (e.code) {
      case "network":
        return "Can't reach the server. Check your connection and try again.";
      case "not_configured":
        return "The API address isn't configured for this environment.";
      case "forbidden":
        return "You don't have access to this.";
      case "account_disabled":
        return "This account has been disabled. Contact a workspace admin.";
      case "rate_limited":
        return "Too many requests. Wait a moment and try again.";
      case "unavailable":
        return "The service is temporarily unavailable. Try again in a minute.";
      case "not_found":
        return e.message || "This wasn't found.";
      default:
        return e.message || fallback;
    }
  }
  return fallback;
}

export async function parseError(res: Response): Promise<ApiRequestError> {
  let code: ApiRequestError["code"] = "unknown";
  let message = res.statusText || "Request failed";
  try {
    const body = (await res.json()) as Partial<ApiErrorBody>;
    if (body?.error?.code) code = body.error.code as KnownErrorCode;
    if (body?.error?.message) message = body.error.message;
  } catch {
    // Non-JSON error body: keep the status text.
  }
  if (code === "unknown") {
    if (res.status === 401) code = "unauthenticated";
    else if (res.status === 403) code = "forbidden";
    else if (res.status === 404) code = "not_found";
    else if (res.status === 409) code = "conflict";
    else if (res.status === 422) code = "validation";
    else if (res.status === 429) code = "rate_limited";
    else if (res.status === 503) code = "unavailable";
    else if (res.status >= 500) code = "internal";
  }
  return new ApiRequestError(res.status, code, message);
}

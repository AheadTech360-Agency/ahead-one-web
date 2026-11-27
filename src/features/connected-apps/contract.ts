/*
 * LOCAL SHAPES for the MCP / OAuth contract. The API is still building these endpoints and their
 * generated bindings have not landed. Mirrors the planned contract; when `npm run sync-types` brings
 * the real types (OAuthRequestInfo, OAuthGrant, ...), delete this file and import from
 * "@/lib/api/types". Every path and field assumed here is listed in the hand-off notes.
 */
import type { UserSummary } from "@/lib/api/types";

export type OAuthScope = {
  /** Opaque scope id, for example "tasks:read". Never rendered as HTML. */
  id: string;
  /** Plain-language description to show next to the checkbox. */
  description: string;
};

/** GET /v1/oauth/requests/{id} */
export type OAuthRequestInfo = {
  id: string;
  /** Display name of the app, user-supplied for dynamically registered clients: render as text only. */
  client_name: string;
  client_id: string;
  /** The registered redirect URI the browser will be sent back to (full URL, no code yet). */
  redirect_uri: string;
  /** Host (and port) of `redirect_uri`, precomputed by the API for display. */
  redirect_host: string;
  scopes: OAuthScope[];
  /** True for dynamically registered clients the workspace has not vetted. */
  unverified: boolean;
  expires_at: string;
};

/** POST /v1/oauth/requests/{id}/decision */
export type OAuthDecision = { approve: boolean; scopes: string[] };
export type OAuthDecisionResult = { redirect_url: string };

/** GET /v1/oauth/grants (mine) and GET /v1/oauth/grants?all=true (Owner: everyone in the workspace). */
export type OAuthGrant = {
  id: string;
  client_name: string;
  client_id: string;
  unverified: boolean;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  calls_this_week: number;
  /** Whose grant it is. Always present on the Owner's workspace-wide listing. */
  user: UserSummary;
};

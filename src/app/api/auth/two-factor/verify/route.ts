import type { NextRequest } from "next/server";
import {
  badBody,
  callApi,
  csrfGuard,
  isSessionTokens,
  readJson,
  relayError,
  sessionResponse,
  str,
  upstreamInvalid,
} from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const blocked = csrfGuard(req);
  if (blocked) return blocked;
  const body = await readJson(req);
  const challengeId = str(body?.challenge_id, 64);
  const code = str(body?.code, 32);
  if (challengeId === null || code === null) return badBody();

  const up = await callApi(req, "/v1/auth/two-factor/verify", { challenge_id: challengeId, code });
  if (up.status !== 200) return relayError(up);
  if (!isSessionTokens(up.body) || !up.body.refresh_token) return upstreamInvalid();
  return sessionResponse(up.body);
}

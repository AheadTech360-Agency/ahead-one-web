import { NextResponse, type NextRequest } from "next/server";
import type { LoginResponse } from "@/lib/api/types";
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
  const email = str(body?.email, 320);
  const password = str(body?.password);
  if (email === null || password === null) return badBody();

  const up = await callApi(req, "/v1/auth/login", { email, password });
  if (up.status !== 200) return relayError(up);

  const data = up.body as LoginResponse | null;
  if (data?.status === "signed_in" && isSessionTokens(data.tokens) && data.tokens.refresh_token) {
    return sessionResponse(data.tokens, { status: "signed_in" });
  }
  if (data?.status === "two_factor_required") {
    // No tokens at this step: pass the challenge through.
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }
  return upstreamInvalid();
}

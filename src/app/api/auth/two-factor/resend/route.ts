import { NextResponse, type NextRequest } from "next/server";
import { badBody, callApi, csrfGuard, readJson, relayError, str } from "@/lib/auth/server";

export async function POST(req: NextRequest) {
  const blocked = csrfGuard(req);
  if (blocked) return blocked;
  const body = await readJson(req);
  const challengeId = str(body?.challenge_id, 64);
  if (challengeId === null) return badBody();

  const up = await callApi(req, "/v1/auth/two-factor/resend", { challenge_id: challengeId });
  if (up.status !== 200) return relayError(up);
  return NextResponse.json(up.body, { headers: { "Cache-Control": "no-store" } });
}

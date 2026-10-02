import { authorizeOperatorRequest } from "../../../../lib/operator/operator-auth";
import { runBimpePreflight } from "../../../../lib/integrations/bimpe/preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const authFailure = authorizeOperatorRequest(request);
  if (authFailure) return authFailure;

  const result = await runBimpePreflight();

  return Response.json({
    ...result,
    message: result.canAttemptTestCall
      ? "BimpeAI preflight passed. A consent-gated test call may be attempted from Mission Control."
      : "BimpeAI preflight is incomplete. No call was placed."
  });
}

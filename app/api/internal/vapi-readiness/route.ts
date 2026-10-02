import { probeVapiReadiness } from "../../../../lib/integrations/voice-runtime/vapi-readiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Preview-only, read-only Vapi account-artifact verification.
 *
 * Returns sanitized readiness only. It never returns provider IDs, API keys,
 * SIP credential IDs, webhook secrets, or phone numbers, and it never places a
 * call.
 */
export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const readiness = await probeVapiReadiness(process.env, fetch);

  return Response.json(readiness, {
    status: readiness.status === "VERIFIED" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex"
    }
  });
}

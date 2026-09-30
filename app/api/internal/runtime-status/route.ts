import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const agentToolToken = process.env.SABI_AGENT_TOOL_TOKEN?.trim();

  let databaseReachable = false;
  let requiredTablesReady = false;

  if (databaseUrl) {
    try {
      const sql = neon(databaseUrl);
      const rows = await sql`
        select
          to_regclass('public.quotes') is not null as quotes_ready,
          to_regclass('public.approvals') is not null as approvals_ready,
          to_regclass('public.communication_event_claims') is not null as claims_ready
      `;

      databaseReachable = true;
      const row = rows[0] as
        | {
            quotes_ready?: boolean;
            approvals_ready?: boolean;
            claims_ready?: boolean;
          }
        | undefined;

      requiredTablesReady = Boolean(
        row?.quotes_ready && row?.approvals_ready && row?.claims_ready
      );
    } catch {
      databaseReachable = false;
      requiredTablesReady = false;
    }
  }

  return Response.json({
    environment: "preview",
    databaseConfigured: Boolean(databaseUrl),
    databaseReachable,
    requiredTablesReady,
    agentToolAuthConfigured: Boolean(agentToolToken)
  });
}

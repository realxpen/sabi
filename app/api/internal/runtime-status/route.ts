import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function jsonRecordCount(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  try {
    const decoded: unknown = JSON.parse(raw);
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return 0;
    return Object.values(decoded).filter(
      (value) => typeof value === "string" && value.trim().length > 0
    ).length;
  } catch {
    return 0;
  }
}

function jsonArrayCount(raw: string | undefined): number {
  if (!raw?.trim()) return 0;
  try {
    const decoded: unknown = JSON.parse(raw);
    return Array.isArray(decoded) ? decoded.length : 0;
  } catch {
    return 0;
  }
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  let databaseReachable = false;
  let missionSnapshotsReady = false;
  let communicationClaimsReady = false;

  if (databaseUrl) {
    try {
      const sql = neon(databaseUrl);
      const rows = await sql`
        select
          exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'mission_snapshots'
          ) as mission_snapshots_ready,
          exists (
            select 1 from information_schema.tables
            where table_schema = 'public' and table_name = 'communication_event_claims'
          ) as communication_claims_ready
      `;

      databaseReachable = true;
      const row = rows[0] as
        | {
            mission_snapshots_ready?: boolean;
            communication_claims_ready?: boolean;
          }
        | undefined;
      missionSnapshotsReady = Boolean(row?.mission_snapshots_ready);
      communicationClaimsReady = Boolean(row?.communication_claims_ready);
    } catch {
      databaseReachable = false;
    }
  }

  const communicationMode =
    process.env.SABI_COMMUNICATION_MODE?.trim() || "mock";
  const liveProviderCount = jsonArrayCount(
    process.env.SABI_LIVE_TEST_PROVIDERS_JSON
  );
  const consentedProviderPhoneCount = jsonRecordCount(
    process.env.SABI_CONSENTED_PROVIDER_PHONES_JSON
  );

  const vapi = {
    apiBaseConfigured: configured(process.env.VAPI_API_BASE_URL),
    apiKeyConfigured: configured(process.env.VAPI_API_KEY),
    assistantConfigured: configured(process.env.VAPI_ASSISTANT_ID),
    sipTrunkConfigured: configured(process.env.VAPI_SIP_TRUNK_CREDENTIAL_ID),
    webhookAuthConfigured: configured(process.env.VAPI_WEBHOOK_TOKEN)
  };

  const vapiConfigured = Object.values(vapi).every(Boolean);

  const bimpe = {
    apiKeyConfigured: configured(process.env.BIMPEAI_API_KEY),
    agentConfigured: configured(process.env.BIMPEAI_AGENT_ID),
    workflowConfigured: configured(process.env.BIMPEAI_WORKFLOW_ID),
    toolAuthConfigured: configured(process.env.SABI_AGENT_TOOL_TOKEN)
  };

  return Response.json({
    environment: "preview",
    database: {
      configured: Boolean(databaseUrl),
      reachable: databaseReachable,
      missionSnapshotsReady,
      communicationClaimsReady
    },
    providerDirectory: {
      configured: liveProviderCount > 0,
      providerCount: liveProviderCount,
      dialingNumbersExposed: false
    },
    communication: {
      mode: communicationMode,
      consentedProviderPhoneCount,
      vapi: { ...vapi, configured: vapiConfigured },
      liveReady: Boolean(
        communicationMode === "vapi-kros" &&
          vapiConfigured &&
          consentedProviderPhoneCount > 0 &&
          liveProviderCount > 0 &&
          databaseReachable &&
          missionSnapshotsReady &&
          communicationClaimsReady
      )
    },
    supervisedEvidence: {
      operatorAuthConfigured: configured(process.env.SABI_OPERATOR_TOKEN),
      transcriptAutoQuoteDisabled: true,
      noAnswerAutoQuoteDisabled: true
    },
    bimpe: {
      ...bimpe,
      configured: Boolean(bimpe.toolAuthConfigured)
    },
    truthGuards: {
      humanApprovalRequired: true,
      transcriptAutoQuoteDisabled: true,
      noAnswerAutoQuoteDisabled: true,
      productionTransactionEnabled: false
    }
  });
}

import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function consentedProviderPhoneCount(raw: string | undefined): number {
  if (!raw?.trim()) {
    return 0;
  }

  try {
    const decoded: unknown = JSON.parse(raw);

    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return 0;
    }

    return Object.values(decoded).filter(
      (value) => typeof value === "string" && value.trim().length > 0
    ).length;
  } catch {
    return 0;
  }
}

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  const agentToolToken = process.env.SABI_AGENT_TOOL_TOKEN?.trim();

  const communicationMode =
    process.env.SABI_COMMUNICATION_MODE?.trim() || "mock";
  const vapiApiBaseConfigured = configured(process.env.VAPI_API_BASE_URL);
  const vapiApiKeyConfigured = configured(process.env.VAPI_API_KEY);
  const vapiAssistantConfigured = configured(process.env.VAPI_ASSISTANT_ID);
  const vapiSipTrunkConfigured = configured(
    process.env.VAPI_SIP_TRUNK_CREDENTIAL_ID
  );
  const vapiWebhookAuthConfigured = configured(
    process.env.VAPI_WEBHOOK_TOKEN
  );
  const consentedPhoneCount = consentedProviderPhoneCount(
    process.env.SABI_CONSENTED_PROVIDER_PHONES_JSON
  );

  const africanVoiceMode =
    process.env.SABI_AFRICAN_VOICE_MODE?.trim() || "disabled";
  const spitchApiKeyConfigured = configured(process.env.SPITCH_API_KEY);
  const livekitUrlConfigured = configured(process.env.LIVEKIT_URL);
  const livekitApiKeyConfigured = configured(process.env.LIVEKIT_API_KEY);
  const livekitApiSecretConfigured = configured(
    process.env.LIVEKIT_API_SECRET
  );
  const livekitAgentConfigured = configured(process.env.LIVEKIT_AGENT_NAME);
  const livekitSipTrunkConfigured = configured(
    process.env.LIVEKIT_SIP_TRUNK_ID
  );

  const messageMode =
    process.env.SABI_MESSAGE_MODE?.trim() || "disabled";
  const voicebipApiKeyConfigured = configured(
    process.env.VOICEBIP_API_KEY
  );
  const voicebipAgentConfigured = configured(
    process.env.VOICEBIP_AGENT_ID
  );
  const voicebipFromNumberConfigured = configured(
    process.env.VOICEBIP_SMS_FROM_NUMBER
  );
  const voicebipWebhookAuthConfigured = configured(
    process.env.VOICEBIP_WEBHOOK_SIGNING_SECRET
  );
  const consentedMessagePhoneCount = consentedProviderPhoneCount(
    process.env.SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON
  );

  let databaseReachable = false;
  let requiredTablesReady = false;
  let communicationCorrelationTableReady = false;

  if (databaseUrl) {
    try {
      const sql = neon(databaseUrl);
      const rows = await sql`
        select
          to_regclass('public.quotes') is not null as quotes_ready,
          to_regclass('public.approvals') is not null as approvals_ready,
          to_regclass('public.communication_event_claims') is not null as claims_ready,
          to_regclass('public.communication_correlations') is not null as correlations_ready
      `;

      databaseReachable = true;
      const row = rows[0] as
        | {
            quotes_ready?: boolean;
            approvals_ready?: boolean;
            claims_ready?: boolean;
            correlations_ready?: boolean;
          }
        | undefined;

      requiredTablesReady = Boolean(
        row?.quotes_ready && row?.approvals_ready && row?.claims_ready
      );
      communicationCorrelationTableReady = Boolean(
        row?.correlations_ready
      );
    } catch {
      databaseReachable = false;
      requiredTablesReady = false;
      communicationCorrelationTableReady = false;
    }
  }

  const vapiConfigured = Boolean(
    vapiApiBaseConfigured &&
      vapiApiKeyConfigured &&
      vapiAssistantConfigured &&
      vapiSipTrunkConfigured &&
      vapiWebhookAuthConfigured
  );

  const africanVoiceConfigured = Boolean(
    spitchApiKeyConfigured &&
      livekitUrlConfigured &&
      livekitApiKeyConfigured &&
      livekitApiSecretConfigured &&
      livekitAgentConfigured &&
      livekitSipTrunkConfigured
  );

  const voicebipConfigured = Boolean(
    voicebipApiKeyConfigured &&
      voicebipAgentConfigured &&
      voicebipFromNumberConfigured &&
      voicebipWebhookAuthConfigured
  );

  return Response.json({
    environment: "preview",
    databaseConfigured: Boolean(databaseUrl),
    databaseReachable,
    requiredTablesReady,
    agentToolAuthConfigured: Boolean(agentToolToken),
    communicationMode,
    vapi: {
      apiBaseConfigured: vapiApiBaseConfigured,
      apiKeyConfigured: vapiApiKeyConfigured,
      assistantConfigured: vapiAssistantConfigured,
      sipTrunkConfigured: vapiSipTrunkConfigured,
      webhookAuthConfigured: vapiWebhookAuthConfigured,
      configured: vapiConfigured
    },
    consentedProviderPhoneCount: consentedPhoneCount,
    liveCommunicationReady: Boolean(
      communicationMode === "vapi-kros" &&
        vapiConfigured &&
        consentedPhoneCount > 0 &&
        databaseReachable &&
        requiredTablesReady
    ),
    africanVoice: {
      mode: africanVoiceMode,
      spitchApiKeyConfigured,
      livekitUrlConfigured,
      livekitApiKeyConfigured,
      livekitApiSecretConfigured,
      livekitAgentConfigured,
      livekitSipTrunkConfigured,
      configured: africanVoiceConfigured,
      readyForExternalAgentProof: Boolean(
        africanVoiceMode === "livekit-spitch" &&
          africanVoiceConfigured
      )
    },
    messaging: {
      mode: messageMode,
      voicebipApiKeyConfigured,
      voicebipAgentConfigured,
      voicebipFromNumberConfigured,
      webhookAuthConfigured: voicebipWebhookAuthConfigured,
      correlationTableReady: communicationCorrelationTableReady,
      consentedProviderPhoneCount: consentedMessagePhoneCount,
      configured: voicebipConfigured,
      liveReady: Boolean(
        messageMode === "voicebip-temlio" &&
          voicebipConfigured &&
          consentedMessagePhoneCount > 0 &&
          databaseReachable &&
          communicationCorrelationTableReady
      )
    }
  });
}

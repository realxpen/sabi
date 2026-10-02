import { z } from "zod";
import { readLiveTestProviders } from "../providers/live-test-directory";

export type BimpePreflightEnvironment = {
  [key: string]: string | undefined;
};

export type BimpePreflightFetch = typeof fetch;

const e164Schema = z.string().regex(/^\+[1-9]\d{6,14}$/);
const consentMapSchema = z.record(e164Schema);

const agentListEnvelopeSchema = z.object({
  data: z.array(
    z
      .object({
        id: z.string().trim().min(1),
        name: z.string().optional(),
        workflow_id: z.string().nullish().optional()
      })
      .passthrough()
  )
});

function configured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function readConsentMap(environment: BimpePreflightEnvironment) {
  const raw = environment.SABI_CONSENTED_PROVIDER_PHONES_JSON?.trim();
  if (!raw) {
    return {
      valid: false,
      providerIds: [] as string[],
      reason: "CONSENTED_PROVIDER_PHONE_MAP_MISSING"
    };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return {
      valid: false,
      providerIds: [] as string[],
      reason: "CONSENTED_PROVIDER_PHONE_MAP_INVALID_JSON"
    };
  }

  const parsed = consentMapSchema.safeParse(decoded);
  if (!parsed.success) {
    return {
      valid: false,
      providerIds: [] as string[],
      reason: "CONSENTED_PROVIDER_PHONE_MAP_INVALID"
    };
  }

  return {
    valid: Object.keys(parsed.data).length > 0,
    providerIds: Object.keys(parsed.data),
    reason:
      Object.keys(parsed.data).length > 0
        ? undefined
        : "CONSENTED_PROVIDER_PHONE_MAP_EMPTY"
  };
}

function readProviderDirectory(environment: BimpePreflightEnvironment) {
  try {
    const providers = readLiveTestProviders(environment);
    return {
      valid: Boolean(providers?.length),
      providerIds: providers?.map((provider) => provider.id) ?? [],
      providerCount: providers?.length ?? 0,
      reason: providers?.length ? undefined : "LIVE_PROVIDER_DIRECTORY_EMPTY"
    };
  } catch (error) {
    return {
      valid: false,
      providerIds: [] as string[],
      providerCount: 0,
      reason:
        error instanceof Error
          ? error.message
          : "LIVE_PROVIDER_DIRECTORY_INVALID"
    };
  }
}

function normalizeBaseUrl(environment: BimpePreflightEnvironment) {
  return (
    environment.BIMPEAI_BASE_URL?.trim() ||
    "https://api.bimpe.ai/api/v1/console"
  ).replace(/\/$/, "");
}

export async function runBimpePreflight(
  environment: BimpePreflightEnvironment = process.env,
  fetchImpl: BimpePreflightFetch = fetch
) {
  const communicationMode = environment.SABI_COMMUNICATION_MODE?.trim() || "mock";
  const apiKey = environment.BIMPEAI_API_KEY?.trim();
  const agentId = environment.BIMPEAI_AGENT_ID?.trim();
  const workflowId = environment.BIMPEAI_WORKFLOW_ID?.trim();
  const apiBaseUrl = normalizeBaseUrl(environment);
  const testCallsEnabled =
    environment.BIMPEAI_TEST_CALLS?.trim().toLowerCase() !== "false";

  let apiBaseValid = false;
  try {
    const parsed = new URL(apiBaseUrl);
    apiBaseValid = parsed.protocol === "https:";
  } catch {
    apiBaseValid = false;
  }

  const directory = readProviderDirectory(environment);
  const consent = readConsentMap(environment);
  const consentedProviderMatches = directory.providerIds.filter((providerId) =>
    consent.providerIds.includes(providerId)
  );

  const local = {
    communicationMode,
    bimpeSelected: communicationMode === "bimpe",
    apiBaseConfigured: configured(environment.BIMPEAI_BASE_URL) || apiBaseValid,
    apiBaseValid,
    apiKeyConfigured: Boolean(apiKey),
    apiKeyLooksValid: Boolean(apiKey?.startsWith("sk_")),
    agentConfigured: Boolean(agentId),
    workflowConfigured: Boolean(workflowId),
    testCallsEnabled,
    operatorAuthConfigured: configured(environment.SABI_OPERATOR_TOKEN),
    agentToolAuthConfigured: configured(environment.SABI_AGENT_TOOL_TOKEN),
    providerDirectoryValid: directory.valid,
    providerCount: directory.providerCount,
    consentMapValid: consent.valid,
    consentedProviderMatchCount: consentedProviderMatches.length,
    consentedProviderMatchReady: consentedProviderMatches.length > 0
  };

  const canProbeRemote = Boolean(
    apiKey && agentId && apiBaseValid
  );

  let remote: {
    attempted: boolean;
    apiReachable: boolean;
    credentialsAccepted: boolean;
    agentVisible: boolean;
    configuredAgentName?: string;
    workflowMatches?: boolean | null;
    httpStatus?: number;
    reason?: string;
  } = {
    attempted: false,
    apiReachable: false,
    credentialsAccepted: false,
    agentVisible: false,
    workflowMatches: null
  };

  if (canProbeRemote) {
    remote.attempted = true;

    let response: Response;
    try {
      response = await fetchImpl(`${apiBaseUrl}/agents?limit=100`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          "X-Request-Id": "sabi-bimpe-preflight"
        },
        cache: "no-store"
      });
    } catch {
      remote.reason = "BIMPE_API_UNREACHABLE";
      response = new Response(null, { status: 599 });
    }

    remote.httpStatus = response.status;
    remote.apiReachable = response.status !== 599;

    if (response.ok) {
      remote.credentialsAccepted = true;

      const decoded = await response.json().catch(() => null);
      const parsed = agentListEnvelopeSchema.safeParse(decoded);

      if (!parsed.success) {
        remote.reason = "BIMPE_AGENT_LIST_RESPONSE_INVALID";
      } else {
        const agent = parsed.data.data.find((candidate) => candidate.id === agentId);
        remote.agentVisible = Boolean(agent);
        remote.configuredAgentName = agent?.name;
        remote.workflowMatches =
          workflowId && agent?.workflow_id
            ? agent.workflow_id === workflowId
            : null;
        if (!agent) remote.reason = "BIMPE_CONFIGURED_AGENT_NOT_VISIBLE";
        if (agent && remote.workflowMatches === false) {
          remote.reason = "BIMPE_WORKFLOW_MISMATCH";
        }
      }
    } else if (response.status === 401) {
      remote.reason = "BIMPE_API_KEY_REJECTED";
    } else if (response.status === 403) {
      remote.credentialsAccepted = true;
      remote.reason = "BIMPE_API_KEY_SCOPE_INSUFFICIENT";
    } else if (response.status === 429) {
      remote.reason = "BIMPE_API_RATE_LIMITED";
    } else if (response.status !== 599) {
      remote.reason = `BIMPE_PREFLIGHT_HTTP_${response.status}`;
    }
  } else {
    remote.reason = "BIMPE_REMOTE_PROBE_NOT_READY";
  }

  const localReady = Boolean(
    local.bimpeSelected &&
      local.apiBaseValid &&
      local.apiKeyConfigured &&
      local.apiKeyLooksValid &&
      local.agentConfigured &&
      local.workflowConfigured &&
      local.testCallsEnabled &&
      local.operatorAuthConfigured &&
      local.agentToolAuthConfigured &&
      local.providerDirectoryValid &&
      local.consentMapValid &&
      local.consentedProviderMatchReady
  );

  const remoteReady = Boolean(
    remote.attempted &&
      remote.apiReachable &&
      remote.credentialsAccepted &&
      remote.agentVisible &&
      remote.workflowMatches !== false
  );

  return {
    local,
    remote,
    canAttemptTestCall: localReady && remoteReady,
    externalActionPerformed: false,
    phoneNumbersExposed: false,
    secretsExposed: false
  };
}

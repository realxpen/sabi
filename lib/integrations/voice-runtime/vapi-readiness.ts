import type { VapiFetch } from "./vapi-http-driver";
import { createLiveVapiVoiceRuntime } from "./vapi-live";
import type { VapiRuntimeEnvironment } from "./vapi";

export type VapiReadinessProbeStatus =
  | "UNCONFIGURED"
  | "VERIFIED"
  | "VERIFICATION_FAILED";

export type VapiReadinessProbeResult = {
  provider: "vapi";
  status: VapiReadinessProbeStatus;
  missingConfiguration: string[];
  communicationMode: string;
  webhookAuthConfigured: boolean;
  ready: boolean;
  checkedAt?: string;
};

/**
 * Sanitized, read-only Vapi readiness probe for preview/runtime verification.
 *
 * The underlying runtime verifies the configured assistant and confirms that
 * the configured SIP trunk credential is attached to a BYO phone-number
 * resource. This wrapper intentionally strips assistant IDs, credential IDs,
 * API keys and webhook secrets from its result.
 *
 * It never creates or initiates a call.
 */
export async function probeVapiReadiness(
  environment: VapiRuntimeEnvironment = process.env,
  fetchImpl: VapiFetch = fetch
): Promise<VapiReadinessProbeResult> {
  const runtime = createLiveVapiVoiceRuntime(environment, fetchImpl);
  const initial = runtime.getReadiness();
  const communicationMode =
    environment.SABI_COMMUNICATION_MODE?.trim() || "mock";
  const webhookAuthConfigured = Boolean(
    environment.VAPI_WEBHOOK_TOKEN?.trim()
  );

  if (initial.status === "UNCONFIGURED") {
    return {
      provider: "vapi",
      status: "UNCONFIGURED",
      missingConfiguration: [...initial.missingConfiguration],
      communicationMode,
      webhookAuthConfigured,
      ready: false
    };
  }

  try {
    const verified = await runtime.verify();

    return {
      provider: "vapi",
      status: "VERIFIED",
      missingConfiguration: [],
      communicationMode,
      webhookAuthConfigured,
      ready: Boolean(
        communicationMode === "vapi-kros" && webhookAuthConfigured
      ),
      checkedAt: verified.checkedAt
    };
  } catch {
    return {
      provider: "vapi",
      status: "VERIFICATION_FAILED",
      missingConfiguration: [],
      communicationMode,
      webhookAuthConfigured,
      ready: false
    };
  }
}

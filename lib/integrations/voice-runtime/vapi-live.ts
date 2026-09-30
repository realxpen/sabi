import { VapiHttpRuntimeDriver, type VapiFetch } from "./vapi-http-driver";
import {
  VapiVoiceRuntime,
  type VapiRuntimeEnvironment
} from "./vapi";

/**
 * Construct the production Vapi runtime from server-side environment values.
 *
 * Verification remains read-only: the HTTP driver only retrieves the
 * configured assistant and lists Vapi phone-number resources to confirm that
 * the configured SIP trunk credential is attached to a BYO phone number.
 */
export function createLiveVapiVoiceRuntime(
  environment: VapiRuntimeEnvironment = process.env,
  fetchImpl: VapiFetch = fetch
): VapiVoiceRuntime {
  return new VapiVoiceRuntime(
    environment,
    new VapiHttpRuntimeDriver(fetchImpl)
  );
}

import { waitUntil } from "@vercel/functions";
import {
  isBimpeMissionOrchestrationConfigured,
  resumeBimpeMissionAfterCommunication
} from "../../../../lib/integrations/bimpe/conversation-orchestrator";
import { createVapiWebhookPostHandler } from "../../../../lib/integrations/communication/vapi-webhook-handler";

export const runtime = "nodejs";

const TERMINAL_COMMUNICATION_STATUSES = new Set([
  "COMPLETED",
  "NO_ANSWER",
  "FAILED",
  "UNAVAILABLE"
]);

type ProcessedWebhookPayload = {
  kind?: string;
  communication?: {
    id?: string;
    missionId?: string;
    status?: string;
  };
};

export async function POST(request: Request): Promise<Response> {
  const response = await createVapiWebhookPostHandler()(request);

  if (!response.ok || !isBimpeMissionOrchestrationConfigured()) {
    return response;
  }

  const payload = (await response
    .clone()
    .json()
    .catch(() => null)) as ProcessedWebhookPayload | null;
  const communication = payload?.communication;

  if (
    payload?.kind === "PROCESSED" &&
    communication?.id &&
    communication.missionId &&
    communication.status &&
    TERMINAL_COMMUNICATION_STATUSES.has(communication.status)
  ) {
    waitUntil(
      resumeBimpeMissionAfterCommunication({
        missionId: communication.missionId,
        communicationId: communication.id,
        communicationStatus: communication.status
      }).catch((error) => {
        console.error(
          `Bimpe mission resume failed for ${communication.missionId}/${communication.id}`,
          error
        );
      })
    );
  }

  return response;
}

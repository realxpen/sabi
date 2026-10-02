import { ZodError, z } from "zod";
import { authorizeOperatorRequest } from "../../../../../lib/operator/operator-auth";
import {
  getLiveVoiceTestEvidence,
  prepareLiveVoiceTestMission,
  refreshLiveVoiceTestCommunication,
  startLiveVoiceTestCall
} from "../../../../../lib/mission/live-voice-test";
import {
  BimpeAIConfigurationError,
  BimpeAIRequestError
} from "../../../../../lib/integrations/communication/bimpe-ai";
import { BimpeEvidenceUnavailableError } from "../../../../../lib/integrations/voice-runtime/bimpe-evidence";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("prepare") }),
  z.object({
    action: z.literal("call"),
    providerId: z.string().trim().min(1)
  }),
  z.object({
    action: z.literal("refresh"),
    communicationId: z.string().trim().min(1)
  }),
  z.object({
    action: z.literal("evidence"),
    communicationId: z.string().trim().min(1)
  })
]);

function errorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      { error: "INVALID_LIVE_VOICE_TEST_REQUEST", details: error.flatten() },
      { status: 400 }
    );
  }

  if (
    error instanceof BimpeAIConfigurationError ||
    error instanceof BimpeAIRequestError ||
    error instanceof BimpeEvidenceUnavailableError
  ) {
    return Response.json(
      {
        error: "BIMPE_VOICE_UNAVAILABLE",
        message: error.message
      },
      { status: 503 }
    );
  }

  const message = error instanceof Error ? error.message : "LIVE_VOICE_TEST_FAILED";

  if (
    message === "MISSION_NOT_FOUND" ||
    message === "PROVIDER_NOT_FOUND" ||
    message === "COMMUNICATION_NOT_FOUND"
  ) {
    return Response.json({ error: message }, { status: 404 });
  }

  if (
    message === "LIVE_TEST_REQUIRES_LIVE_MISSION" ||
    message === "MISSION_NOT_READY_FOR_PROVIDER_CALL" ||
    message === "COMMUNICATION_NOT_COMPLETED" ||
    message === "COMMUNICATION_MISSION_MISMATCH"
  ) {
    return Response.json({ error: message }, { status: 409 });
  }

  if (
    message === "BIMPE_LIVE_TEST_NOT_ENABLED" ||
    message === "LIVE_COMMUNICATION_ADAPTER_REQUIRED" ||
    message === "COMMUNICATION_REFRESH_NOT_SUPPORTED"
  ) {
    return Response.json(
      {
        error: message,
        message:
          "BimpeAI Live Voice Test is not fully configured. No provider was contacted."
      },
      { status: 503 }
    );
  }

  console.error("Live Voice Test failed", error);
  return Response.json(
    {
      error: "LIVE_VOICE_TEST_FAILED",
      message:
        "SABI stopped the live voice test safely. No purchase, booking or payment was performed."
    },
    { status: 500 }
  );
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<Response> {
  const authFailure = authorizeOperatorRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => null);

  try {
    const action = actionSchema.parse(body);

    switch (action.action) {
      case "prepare": {
        const result = await prepareLiveVoiceTestMission(params.id);
        return Response.json({
          action: "prepare",
          missionStatus: result.snapshot.mission.status,
          providers: result.snapshot.providers,
          readyToCall: result.readyToCall,
          reason: result.reason,
          externalActionAttempted: false,
          transactionPerformed: false
        });
      }

      case "call": {
        const result = await startLiveVoiceTestCall(
          params.id,
          action.providerId
        );
        return Response.json({
          action: "call",
          missionStatus: result.snapshot.mission.status,
          communication: result.communication,
          reusedExistingActiveCommunication:
            result.reusedExistingActiveCommunication,
          externalActionAttempted: result.externalActionAttempted,
          transactionPerformed: false
        });
      }

      case "refresh": {
        const result = await refreshLiveVoiceTestCommunication(
          params.id,
          action.communicationId
        );
        return Response.json({
          action: "refresh",
          missionStatus: result.snapshot.mission.status,
          communication: result.communication,
          transactionPerformed: false
        });
      }

      case "evidence": {
        const evidence = await getLiveVoiceTestEvidence(
          params.id,
          action.communicationId
        );
        return Response.json({
          action: "evidence",
          evidence,
          transactionPerformed: false
        });
      }
    }
  } catch (error) {
    return errorResponse(error);
  }
}

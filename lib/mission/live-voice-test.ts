import { randomUUID } from "node:crypto";
import { missionStepSchema } from "../schemas";
import {
  getMissionSnapshot,
  saveMissionSnapshot
} from "../integrations/neon/mission-snapshot-repository";
import {
  callProviderForAgent,
  refreshCommunicationForAgent
} from "../integrations/bimpe/communication-runtime";
import { getCommunicationEvidenceForAgent } from "../integrations/bimpe/communication-evidence";
import { advanceMissionOrchestration } from "./orchestrator";
import { transitionMission } from "./state-machine";

type LiveVoiceTransport = "bimpe" | "vapi-kros";

function assertLiveVoiceTestConfigured(): LiveVoiceTransport {
  const mode = process.env.SABI_COMMUNICATION_MODE?.trim();
  if (mode === "bimpe" || mode === "vapi-kros") return mode;
  throw new Error("BIMPE_LIVE_TEST_NOT_ENABLED");
}

async function requireLiveMission(missionId: string) {
  const snapshot = await getMissionSnapshot(missionId);
  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  if (snapshot.demoMode) throw new Error("LIVE_TEST_REQUIRES_LIVE_MISSION");
  return snapshot;
}

/**
 * Advance a live mission only through the pre-contact stages.
 *
 * The operator can safely prepare provider discovery and reach CONTACTING, but
 * this helper deliberately stops before any communication adapter is invoked.
 */
export async function prepareLiveVoiceTestMission(missionId: string) {
  assertLiveVoiceTestConfigured();
  let snapshot = await requireLiveMission(missionId);

  for (let index = 0; index < 5; index += 1) {
    if (snapshot.mission.status === "CONTACTING") {
      return {
        snapshot,
        readyToCall: snapshot.providers.length > 0,
        reason:
          snapshot.providers.length > 0
            ? "READY_FOR_CONSENTED_PROVIDER_CALL"
            : "WAITING_FOR_PROVIDER_DISCOVERY"
      };
    }

    if (
      snapshot.mission.status === "COLLECTING_QUOTES" ||
      snapshot.mission.status === "COMPARING" ||
      snapshot.mission.status === "AWAITING_APPROVAL" ||
      snapshot.mission.status === "APPROVED" ||
      snapshot.mission.status === "COMPLETED"
    ) {
      return {
        snapshot,
        readyToCall: false,
        reason: `MISSION_ALREADY_AT_${snapshot.mission.status}`
      };
    }

    const result = await advanceMissionOrchestration(missionId, { mode: "LIVE" });
    snapshot = result.snapshot;

    if (result.outcome === "WAITING" && snapshot.mission.status !== "SEARCHING") {
      return { snapshot, readyToCall: false, reason: result.reason };
    }

    if (
      snapshot.mission.status === "SEARCHING" &&
      snapshot.providers.length === 0
    ) {
      return {
        snapshot,
        readyToCall: false,
        reason: "WAITING_FOR_PROVIDER_DISCOVERY"
      };
    }
  }

  return {
    snapshot,
    readyToCall:
      snapshot.mission.status === "CONTACTING" && snapshot.providers.length > 0,
    reason: snapshot.mission.status
  };
}

/**
 * Initiate exactly one operator-selected, consent-gated live call, then move
 * the mission into evidence collection. No other provider is contacted.
 */
export async function startLiveVoiceTestCall(
  missionId: string,
  providerId: string
) {
  const transport = assertLiveVoiceTestConfigured();
  const before = await requireLiveMission(missionId);

  if (before.mission.status !== "CONTACTING") {
    throw new Error("MISSION_NOT_READY_FOR_PROVIDER_CALL");
  }

  const result = await callProviderForAgent({ missionId, providerId });
  let snapshot = result.snapshot;

  if (snapshot.mission.status === "CONTACTING") {
    const mission = transitionMission(snapshot.mission, "COLLECTING_QUOTES");
    const step = missionStepSchema.parse({
      id: `step-${randomUUID()}`,
      missionId,
      type: "COLLECT_QUOTES",
      status: "RUNNING",
      message:
        transport === "vapi-kros"
          ? "One operator-selected consenting provider call was initiated through Vapi over the configured Kros BYO SIP transport. Waiting for authenticated call events and factual evidence."
          : "One operator-selected consenting provider call was initiated through BimpeAI. Waiting for the call outcome and factual evidence.",
      createdAt: new Date().toISOString()
    });

    snapshot = await saveMissionSnapshot({
      ...snapshot,
      mission,
      steps: [...snapshot.steps, step]
    });
  }

  return {
    communication: result.communication,
    snapshot,
    reusedExistingActiveCommunication:
      result.reusedExistingActiveCommunication,
    externalActionAttempted: true,
    transactionPerformed: false
  };
}

export async function refreshLiveVoiceTestCommunication(
  missionId: string,
  communicationId: string
) {
  const transport = assertLiveVoiceTestConfigured();
  const snapshot = await requireLiveMission(missionId);

  const communication = snapshot.communications.find(
    (candidate) => candidate.id === communicationId
  );
  if (!communication) throw new Error("COMMUNICATION_NOT_FOUND");
  if (communication.missionId !== snapshot.mission.id) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }

  // Vapi/Kros lifecycle state is pushed into SABI through authenticated Vapi
  // webhooks. For that transport, "refresh" means rereading the persisted
  // Mission snapshot; it must not create a second provider-side polling path.
  if (transport === "vapi-kros") {
    return {
      communication,
      snapshot,
      refreshSource: "persisted-webhook-state" as const,
      transactionPerformed: false
    };
  }

  const result = await refreshCommunicationForAgent({
    missionId,
    communicationId
  });

  return {
    ...result,
    refreshSource: "transport-poll" as const,
    transactionPerformed: false
  };
}

export async function getLiveVoiceTestEvidence(
  missionId: string,
  communicationId: string
) {
  assertLiveVoiceTestConfigured();
  await requireLiveMission(missionId);

  const evidence = await getCommunicationEvidenceForAgent({
    missionId,
    communicationId
  });

  return {
    ...evidence,
    evidenceOnly: true,
    transcriptPersistedToMission: false,
    quoteCreated: false,
    transactionPerformed: false
  };
}

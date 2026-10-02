import { z } from "zod";
import { getMissionSnapshot } from "../neon/mission-snapshot-repository";
import { createConfiguredCommunicationAdapter } from "../communication/live-runtime";
import { recordCommunicationInMission } from "../../mission/persisted-integration";

export const callProviderToolInputSchema = z.object({
  missionId: z.string().trim().min(1),
  providerId: z.string().trim().min(1)
});

export const refreshCommunicationToolInputSchema = z.object({
  missionId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1)
});

/**
 * Initiate exactly one consent-gated provider call through the configured live
 * adapter and persist only the normalized CommunicationResult.
 *
 * This does not create a Quote, advance to approval, purchase, book or pay.
 */
export async function callProviderForAgent(
  input: z.infer<typeof callProviderToolInputSchema>
) {
  const parsed = callProviderToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(parsed.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");
  if (snapshot.mission.status !== "CONTACTING") {
    throw new Error("MISSION_NOT_READY_FOR_PROVIDER_CALL");
  }
  if (!snapshot.providers.some((provider) => provider.id === parsed.providerId)) {
    throw new Error("PROVIDER_NOT_FOUND");
  }

  const duplicateActive = snapshot.communications.find(
    (communication) =>
      communication.providerId === parsed.providerId &&
      (communication.status === "INITIATED" ||
        communication.status === "IN_PROGRESS")
  );

  if (duplicateActive) {
    return {
      communication: duplicateActive,
      snapshot,
      reusedExistingActiveCommunication: true
    };
  }

  const adapter = createConfiguredCommunicationAdapter();
  if (adapter.name === "mock" || adapter.name === "invalid-communication-mode") {
    throw new Error("LIVE_COMMUNICATION_ADAPTER_REQUIRED");
  }

  const communication = await adapter.initiateContact({
    missionId: snapshot.mission.id,
    providerId: parsed.providerId,
    objective: `Confirm availability, total price, delivery fee and delivery timing for: ${snapshot.mission.rawRequest}`
  });

  const persisted = await recordCommunicationInMission({
    missionId: snapshot.mission.id,
    communication
  });

  return {
    communication,
    snapshot: persisted,
    reusedExistingActiveCommunication: false
  };
}

/**
 * Poll the configured provider for the latest state of one persisted call.
 * Transcript text remains outside Mission state and must be requested through
 * getCommunicationEvidence after the communication reaches COMPLETED.
 */
export async function refreshCommunicationForAgent(
  input: z.infer<typeof refreshCommunicationToolInputSchema>
) {
  const parsed = refreshCommunicationToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(parsed.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");

  const communication = snapshot.communications.find(
    (candidate) => candidate.id === parsed.communicationId
  );
  if (!communication) throw new Error("COMMUNICATION_NOT_FOUND");
  if (communication.missionId !== snapshot.mission.id) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }

  const adapter = createConfiguredCommunicationAdapter();
  if (!adapter.refreshCommunication) {
    throw new Error("COMMUNICATION_REFRESH_NOT_SUPPORTED");
  }

  const refreshed = await adapter.refreshCommunication(communication);
  const persisted = await recordCommunicationInMission({
    missionId: snapshot.mission.id,
    communication: refreshed
  });

  return { communication: refreshed, snapshot: persisted };
}

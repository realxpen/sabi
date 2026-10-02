import { z } from "zod";
import { getMissionSnapshot } from "../neon/mission-snapshot-repository";
import { fromBimpeExternalId } from "../communication/bimpe-ai";
import { getBimpeCallEvidence } from "../voice-runtime/bimpe-evidence";
import {
  getVapiCallEvidence,
  type VapiEvidenceEnvironment,
  type VapiEvidenceFetch
} from "../voice-runtime/vapi-evidence";

export const getCommunicationEvidenceToolInputSchema = z.object({
  missionId: z.string().trim().min(1),
  communicationId: z.string().trim().min(1)
});

/**
 * Resolve server-side transcript evidence for one completed persisted call.
 *
 * The transcript is returned to the authenticated agent caller but is not
 * written into Mission state. The next step must explicitly extract factual
 * fields and submit them through recordProviderResponse.
 */
export async function getCommunicationEvidenceForAgent(
  input: z.infer<typeof getCommunicationEvidenceToolInputSchema>,
  environment: VapiEvidenceEnvironment = process.env,
  fetchImpl: VapiEvidenceFetch = fetch
) {
  const parsed = getCommunicationEvidenceToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(parsed.missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");

  const communication = snapshot.communications.find(
    (candidate) => candidate.id === parsed.communicationId
  );

  if (!communication) throw new Error("COMMUNICATION_NOT_FOUND");
  if (communication.missionId !== snapshot.mission.id) {
    throw new Error("COMMUNICATION_MISSION_MISMATCH");
  }
  if (communication.channel !== "CALL") {
    throw new Error("COMMUNICATION_EVIDENCE_NOT_A_CALL");
  }
  if (communication.status !== "COMPLETED") {
    throw new Error("COMMUNICATION_NOT_COMPLETED");
  }
  if (!communication.externalId) {
    throw new Error("COMMUNICATION_EXTERNAL_ID_MISSING");
  }

  const evidence = fromBimpeExternalId(communication.externalId)
    ? await getBimpeCallEvidence(
        communication.externalId,
        environment,
        fetchImpl
      )
    : await getVapiCallEvidence(
        communication.externalId,
        environment,
        fetchImpl
      );

  return {
    missionId: snapshot.mission.id,
    providerId: communication.providerId,
    communicationId: communication.id,
    callId: evidence.callId,
    transcript: evidence.transcript,
    sourceReference: evidence.sourceReference
  };
}

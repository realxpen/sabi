import { z } from "zod";
import { getMissionSnapshot } from "../neon/mission-snapshot-repository";

export const getMissionStateToolInputSchema = z.object({
  missionId: z.string().trim().min(1)
});

/**
 * Read-only recovery view for Bimpe.
 *
 * This lets the agent recover the persisted Mission and its real communication
 * IDs instead of relying on conversational memory. It never advances state,
 * contacts a provider, creates a Quote, requests approval, or performs a
 * transaction.
 */
export async function getMissionStateForAgent(
  input: z.infer<typeof getMissionStateToolInputSchema>
) {
  const { missionId } = getMissionStateToolInputSchema.parse(input);
  const snapshot = await getMissionSnapshot(missionId);

  if (!snapshot) throw new Error("MISSION_NOT_FOUND");

  const communications = snapshot.communications.map((communication) => ({
    id: communication.id,
    providerId: communication.providerId,
    channel: communication.channel,
    status: communication.status,
    occurredAt: communication.occurredAt,
    errorCode: communication.errorCode
  }));

  const latestCommunication = communications.at(-1);

  return {
    missionId: snapshot.mission.id,
    status: snapshot.mission.status,
    rawRequest: snapshot.mission.rawRequest,
    providers: snapshot.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      category: provider.category,
      location: provider.location,
      active: provider.active
    })),
    communications,
    latestCommunicationId: latestCommunication?.id,
    quoteIds: snapshot.quotes.map((quote) => quote.id),
    recommendation: snapshot.recommendation
  };
}

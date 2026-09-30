import { describe, expect, it } from "vitest";
import { applyCommunicationResultToMission } from "../lib/mission/communication-bridge";
import { communicationResultSchema, missionSchema } from "../lib/schemas";

const mission = missionSchema.parse({
  id: "mission-demo",
  type: "PROCUREMENT",
  status: "CONTACTING",
  rawRequest: "Find roofing sheets",
  item: "roofing sheets",
  quantity: 20,
  unit: "sheets",
  approvalRequired: true,
  createdAt: "2026-09-30T18:00:00.000Z"
});

function communication(status: "INITIATED" | "IN_PROGRESS" | "COMPLETED" | "NO_ANSWER" | "UNAVAILABLE" | "FAILED") {
  return communicationResultSchema.parse({
    id: `comm-${status.toLowerCase()}`,
    missionId: "mission-demo",
    providerId: "provider-demo",
    channel: "CALL",
    status,
    summary: "private provider transcript text should not enter MissionStep",
    occurredAt: "2026-09-30T18:05:00.000Z"
  });
}

describe("communication Mission bridge", () => {
  it("records no-answer as a failed communication step without failing the Mission", () => {
    const result = applyCommunicationResultToMission({
      mission,
      communication: communication("NO_ANSWER")
    });

    expect(result.mission.status).toBe("CONTACTING");
    expect(result.step).toMatchObject({
      missionId: "mission-demo",
      type: "PROVIDER_COMMUNICATION",
      status: "FAILED",
      message: "Provider communication ended without an answer."
    });
  });

  it("keeps initiated contact running without advancing Mission state", () => {
    const result = applyCommunicationResultToMission({
      mission,
      communication: communication("INITIATED")
    });

    expect(result.mission.status).toBe("CONTACTING");
    expect(result.step.status).toBe("RUNNING");
  });

  it("allows an explicit valid state-machine transition after a completed communication", () => {
    const result = applyCommunicationResultToMission({
      mission,
      communication: communication("COMPLETED"),
      requestedTransition: "COLLECTING_QUOTES"
    });

    expect(result.mission.status).toBe("COLLECTING_QUOTES");
    expect(result.step.status).toBe("COMPLETED");
  });

  it("rejects explicit transitions that violate the existing Mission state machine", () => {
    expect(() =>
      applyCommunicationResultToMission({
        mission,
        communication: communication("COMPLETED"),
        requestedTransition: "COMPARING"
      })
    ).toThrow("Invalid mission transition: CONTACTING -> COMPARING");
  });

  it("rejects a CommunicationResult correlated to another Mission", () => {
    const wrongMissionCommunication = communicationResultSchema.parse({
      id: "comm-other",
      missionId: "mission-other",
      providerId: "provider-demo",
      channel: "CALL",
      status: "COMPLETED",
      occurredAt: "2026-09-30T18:05:00.000Z"
    });

    expect(() =>
      applyCommunicationResultToMission({
        mission,
        communication: wrongMissionCommunication
      })
    ).toThrow("Communication/Mission correlation mismatch");
  });

  it("does not copy provider summary or transcript-like content into MissionStep", () => {
    const result = applyCommunicationResultToMission({
      mission,
      communication: communication("COMPLETED")
    });

    expect(JSON.stringify(result.step)).not.toContain("private provider transcript text");
  });
});

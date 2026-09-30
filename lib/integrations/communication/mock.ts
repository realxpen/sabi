import { z } from "zod";
import {
  communicationObservationSchema,
  communicationResultSchema,
  type CommunicationResult,
  type CommunicationStatus
} from "../../schemas";
import type {
  CommunicationAdapter,
  ContactProviderInput
} from "./types";

export const mockCommunicationEventStatusSchema = z.enum([
  "initiated",
  "in_progress",
  "completed",
  "no_answer",
  "unavailable",
  "failed"
]);

export const mockCommunicationEventSchema = z
  .object({
    eventId: z.string().trim().min(1),
    missionId: z.string().trim().min(1),
    providerId: z.string().trim().min(1),
    status: mockCommunicationEventStatusSchema,
    externalId: z.string().trim().min(1).optional(),
    summary: z.string().trim().min(1).optional(),
    observation: communicationObservationSchema.optional(),
    errorCode: z.string().trim().min(1).optional(),
    occurredAt: z.string().datetime()
  })
  .superRefine((event, ctx) => {
    if (event.status !== "completed" && event.observation) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["observation"],
        message: "Only completed mock events may include observations."
      });
    }
  });

export type MockCommunicationEvent = z.infer<
  typeof mockCommunicationEventSchema
>;

const MOCK_STATUS_MAP: Record<
  MockCommunicationEvent["status"],
  CommunicationStatus
> = {
  initiated: "INITIATED",
  in_progress: "IN_PROGRESS",
  completed: "COMPLETED",
  no_answer: "NO_ANSWER",
  unavailable: "UNAVAILABLE",
  failed: "FAILED"
};

function defaultMockSummary(status: CommunicationStatus): string {
  return `Mock communication event normalized as ${status}. No real provider communication occurred.`;
}

export class MockCommunicationAdapter implements CommunicationAdapter {
  readonly name = "mock";

  async initiateContact(
    input: ContactProviderInput
  ): Promise<CommunicationResult> {
    return communicationResultSchema.parse({
      id: `mock-${input.missionId}-${input.providerId}`,
      missionId: input.missionId,
      providerId: input.providerId,
      channel: "MOCK",
      status: "INITIATED",
      summary: "Mock contact initiated. No real provider was contacted.",
      occurredAt: new Date().toISOString()
    });
  }

  async normalizeEvent(payload: unknown): Promise<CommunicationResult> {
    const event = mockCommunicationEventSchema.parse(payload);
    const status = MOCK_STATUS_MAP[event.status];

    return communicationResultSchema.parse({
      id: `mock-event-${event.eventId}`,
      missionId: event.missionId,
      providerId: event.providerId,
      channel: "MOCK",
      status,
      externalId: event.externalId ?? event.eventId,
      summary: event.summary ?? defaultMockSummary(status),
      observation: event.observation,
      errorCode: event.errorCode,
      occurredAt: event.occurredAt
    });
  }
}

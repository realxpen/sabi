import { ZodError, z } from "zod";
import { authorizeOperatorRequest } from "../../../../../../../lib/operator/operator-auth";
import { recordSupervisedProviderEvidence } from "../../../../../../../lib/mission/supervised-evidence";

export const runtime = "nodejs";

const evidenceSchema = z.object({
  available: z.boolean(),
  quantity: z.number().positive().optional(),
  unit: z.string().trim().min(1).optional(),
  price: z.number().nonnegative().optional(),
  deliveryFee: z.number().nonnegative().optional(),
  total: z.number().nonnegative().optional(),
  deliveryDate: z.string().trim().min(1).optional(),
  notes: z.string().trim().min(1).optional()
});

export async function POST(
  request: Request,
  { params }: { params: { id: string; communicationId: string } }
): Promise<Response> {
  const authFailure = authorizeOperatorRequest(request);
  if (authFailure) return authFailure;

  const body = await request.json().catch(() => null);

  try {
    const facts = evidenceSchema.parse(body);
    const result = await recordSupervisedProviderEvidence({
      missionId: params.id,
      communicationId: params.communicationId,
      ...facts
    });

    return Response.json({
      missionId: params.id,
      communicationId: params.communicationId,
      quote: result.quote,
      missionStatus: result.snapshot.mission.status,
      recommendation: result.snapshot.recommendation,
      allProviderContactsSettled: result.allProviderContactsSettled,
      completedEvidencePending: result.completedEvidencePending,
      consequentialActionPerformed: false
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_SUPERVISED_EVIDENCE", details: error.flatten() },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "SUPERVISED_EVIDENCE_FAILED";

    if (message === "MISSION_NOT_FOUND" || message === "COMMUNICATION_NOT_FOUND") {
      return Response.json({ error: message }, { status: 404 });
    }

    if (
      message === "COMMUNICATION_NOT_COMPLETED" ||
      message === "COMMUNICATION_MISSION_MISMATCH" ||
      message === "COMMUNICATION_PROVIDER_MISMATCH" ||
      message === "MISSION_NOT_READY_FOR_QUOTE_RECORDING" ||
      message === "MOCK_EVIDENCE_NOT_ALLOWED_FOR_LIVE_MISSION"
    ) {
      return Response.json({ error: message }, { status: 409 });
    }

    console.error("Failed to record supervised provider evidence", error);
    return Response.json(
      {
        error: "SUPERVISED_EVIDENCE_FAILED",
        message:
          "SABI did not save the evidence. No quote, recommendation or transaction was fabricated."
      },
      { status: 500 }
    );
  }
}

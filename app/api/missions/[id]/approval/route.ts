import { z } from "zod";
import { approvalSchema } from "../../../../../lib/schemas";

const approvalRequestSchema = z.object({
  providerId: z.string().min(1),
  quoteId: z.string().min(1)
});

export async function POST(
  request: Request,
  context: { params: { id: string } }
) {
  const body = await request.json().catch(() => null);
  const parsed = approvalRequestSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      {
        error: "INVALID_APPROVAL_REQUEST",
        details: parsed.error.flatten()
      },
      { status: 400 }
    );
  }

  const approval = approvalSchema.parse({
    id: `${context.params.id}-approval`,
    missionId: context.params.id,
    action: "SELECT_PROVIDER",
    providerId: parsed.data.providerId,
    quoteId: parsed.data.quoteId,
    status: "APPROVED",
    createdAt: new Date().toISOString()
  });

  return Response.json({
    approval,
    missionStatus: "APPROVED",
    transactionPerformed: false,
    message:
      "Human approval recorded for the Phase 1 demo. No financial or external transaction was performed."
  });
}

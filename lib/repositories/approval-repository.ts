import { approvalSchema, type Approval } from "../schemas";

export interface ApprovalRepository {
  save(approval: Approval): Promise<Approval>;
  getById(approvalId: string): Promise<Approval | undefined>;
}

/**
 * Shared validation keeps raw storage rows out of SABI domain logic.
 */
export function validateStoredApproval(candidate: unknown): Approval {
  return approvalSchema.parse(candidate);
}

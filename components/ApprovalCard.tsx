"use client";

import { useState } from "react";
import type { Mission, Provider, Quote } from "../lib/schemas";

type ApprovalCardProps = {
  mission: Mission;
  provider?: Provider;
  quote?: Quote;
};

export function ApprovalCard({
  mission,
  provider,
  quote
}: ApprovalCardProps) {
  const [decision, setDecision] = useState<
    "PENDING" | "APPROVED" | "CANCELLED"
  >("PENDING");

  if (!provider || !quote) {
    return (
      <section className="approvalCard">
        <div className="eyebrow">Human approval</div>
        <h2>No qualifying recommendation yet</h2>
        <p>SABI will not proceed until a valid option exists.</p>
      </section>
    );
  }

  return (
    <section className="approvalCard">
      <div className="eyebrow">Human approval</div>

      {decision === "PENDING" ? (
        <>
          <h2>Ready for your decision</h2>
          <p>
            {provider.name} is the current recommendation for{" "}
            <strong>
              {quote.total !== undefined
                ? `₦${quote.total.toLocaleString()}`
                : "an unknown total"}
            </strong>
            .
          </p>

          <div className="approvalActions">
            <button
              className="primaryAction"
              type="button"
              onClick={() => setDecision("APPROVED")}
            >
              Approve demo choice
            </button>
            <button
              className="secondaryAction"
              type="button"
              onClick={() => setDecision("CANCELLED")}
            >
              Cancel
            </button>
          </div>

          <p className="safetyNote">
            Approval is recorded only in this Phase 1 interface. No purchase,
            booking, transfer, or payment is performed.
          </p>
        </>
      ) : decision === "APPROVED" ? (
        <>
          <h2>Choice approved</h2>
          <p>
            The human checkpoint is complete for mission{" "}
            <strong>{mission.id}</strong>.
          </p>
          <p className="safetyNote">
            No transaction was performed. The hackathon MVP intentionally
            stops at approval.
          </p>
        </>
      ) : (
        <>
          <h2>Mission stopped</h2>
          <p>No external or financial action was taken.</p>
        </>
      )}
    </section>
  );
}

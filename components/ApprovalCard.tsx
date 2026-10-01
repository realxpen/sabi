"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Mission, Provider, Quote } from "../lib/schemas";

type ApprovalCardProps = {
  mission: Mission;
  provider?: Provider;
  quote?: Quote;
};

type Decision = "PENDING" | "APPROVING" | "APPROVED" | "CANCELLED";

export function ApprovalCard({
  mission,
  provider,
  quote
}: ApprovalCardProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>(
    mission.status === "APPROVED" ? "APPROVED" : "PENDING"
  );
  const [error, setError] = useState<string | null>(null);

  if (!provider || !quote) {
    return (
      <section className="approvalCard">
        <div className="eyebrow">Human approval</div>
        <h2>No qualifying recommendation yet</h2>
        <p>SABI will not proceed until a valid option exists.</p>
      </section>
    );
  }

  async function approve() {
    if (decision !== "PENDING") return;

    setDecision("APPROVING");
    setError(null);

    try {
      const response = await fetch(`/api/missions/${mission.id}/approval`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          providerId: provider.id,
          quoteId: quote.id
        })
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.missionStatus !== "APPROVED") {
        throw new Error("SABI could not persist this approval.");
      }

      setDecision("APPROVED");
      router.refresh();
    } catch (caught) {
      setDecision("PENDING");
      setError(
        caught instanceof Error
          ? caught.message
          : "SABI could not persist this approval."
      );
    }
  }

  return (
    <section className="approvalCard">
      <div className="eyebrow">Human approval</div>

      {decision === "PENDING" || decision === "APPROVING" ? (
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
              onClick={approve}
              disabled={decision === "APPROVING"}
            >
              {decision === "APPROVING" ? "Saving approval…" : "Approve choice"}
            </button>
            <button
              className="secondaryAction"
              type="button"
              onClick={() => setDecision("CANCELLED")}
              disabled={decision === "APPROVING"}
            >
              Cancel
            </button>
          </div>

          {error ? <p className="formError">{error}</p> : null}
          <p className="safetyNote">
            Approval updates the persisted mission state only. No purchase,
            booking, transfer, or payment is performed.
          </p>
        </>
      ) : decision === "APPROVED" ? (
        <>
          <h2>Choice approved</h2>
          <p>
            The human checkpoint is persisted for mission{" "}
            <strong>{mission.id}</strong>.
          </p>
          <p className="safetyNote">
            No transaction was performed. The hackathon MVP intentionally
            stops at approval.
          </p>
        </>
      ) : (
        <>
          <h2>Mission stopped locally</h2>
          <p>No external or financial action was taken.</p>
        </>
      )}
    </section>
  );
}

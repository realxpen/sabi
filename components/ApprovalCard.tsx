"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Mission, Provider, Quote } from "../lib/schemas";

type ApprovalCardProps = {
  mission: Mission;
  provider?: Provider;
  quote?: Quote;
};

type Decision =
  | "PENDING"
  | "APPROVING"
  | "CANCELLING"
  | "APPROVED"
  | "CANCELLED";

export function ApprovalCard({
  mission,
  provider,
  quote
}: ApprovalCardProps) {
  const router = useRouter();
  const [decision, setDecision] = useState<Decision>(
    mission.status === "APPROVED"
      ? "APPROVED"
      : mission.status === "CANCELLED"
        ? "CANCELLED"
        : "PENDING"
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

  const selectedProvider = provider;
  const selectedQuote = quote;

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
          providerId: selectedProvider.id,
          quoteId: selectedQuote.id
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

  async function cancelMission() {
    if (decision !== "PENDING") return;

    setDecision("CANCELLING");
    setError(null);

    try {
      const response = await fetch(`/api/missions/${mission.id}/cancel`, {
        method: "POST"
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || result?.missionStatus !== "CANCELLED") {
        throw new Error("SABI could not persist this cancellation.");
      }

      setDecision("CANCELLED");
      router.refresh();
    } catch (caught) {
      setDecision("PENDING");
      setError(
        caught instanceof Error
          ? caught.message
          : "SABI could not persist this cancellation."
      );
    }
  }

  return (
    <section className="approvalCard">
      <div className="eyebrow">Human approval</div>

      {decision === "PENDING" ||
      decision === "APPROVING" ||
      decision === "CANCELLING" ? (
        <>
          <h2>Ready for your decision</h2>
          <p>
            {selectedProvider.name} is the current recommendation for{" "}
            <strong>
              {selectedQuote.total !== undefined
                ? `₦${selectedQuote.total.toLocaleString()}`
                : "an unknown total"}
            </strong>
            .
          </p>

          <div className="approvalActions">
            <button
              className="primaryAction"
              type="button"
              onClick={approve}
              disabled={decision !== "PENDING"}
            >
              {decision === "APPROVING" ? "Saving approval…" : "Approve choice"}
            </button>
            <button
              className="secondaryAction"
              type="button"
              onClick={cancelMission}
              disabled={decision !== "PENDING"}
            >
              {decision === "CANCELLING" ? "Cancelling…" : "Cancel mission"}
            </button>
          </div>

          {error ? <p className="formError">{error}</p> : null}
          <p className="safetyNote">
            Approval or cancellation updates the persisted mission state only.
            No purchase, booking, transfer, or payment is performed.
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
          <h2>Mission cancelled</h2>
          <p>The human cancellation is persisted.</p>
          <p className="safetyNote">
            No external or financial action was taken after cancellation.
          </p>
        </>
      )}
    </section>
  );
}

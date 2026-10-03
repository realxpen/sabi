"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Mission, Provider, Quote } from "../lib/schemas";
import styles from "./ApprovalCard.module.css";

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

  if (!provider || !quote) return null;

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
        throw new Error("SABI could not save this approval.");
      }

      setDecision("APPROVED");
      router.refresh();
    } catch (caught) {
      setDecision("PENDING");
      setError(
        caught instanceof Error
          ? caught.message
          : "SABI could not save this approval."
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
        throw new Error("SABI could not cancel this mission.");
      }

      setDecision("CANCELLED");
      router.refresh();
    } catch (caught) {
      setDecision("PENDING");
      setError(
        caught instanceof Error
          ? caught.message
          : "SABI could not cancel this mission."
      );
    }
  }

  const total =
    selectedQuote.total !== undefined
      ? `₦${selectedQuote.total.toLocaleString()}`
      : "Total pending";

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>Human approval</div>

      {decision === "PENDING" ||
      decision === "APPROVING" ||
      decision === "CANCELLING" ? (
        <>
          <div className={styles.header}>
            <div>
              <h2>Ready for your decision</h2>
              <p>
                SABI recommends <strong>{selectedProvider.name}</strong>. Review
                the verified option above, then decide whether to accept it.
              </p>
            </div>
            <div className={styles.total}>
              <strong>{total}</strong>
              <span>verified total</span>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              className={styles.primary}
              type="button"
              onClick={approve}
              disabled={decision !== "PENDING"}
            >
              {decision === "APPROVING" ? "Saving approval…" : `Approve ${total}`}
              {decision === "PENDING" ? <span aria-hidden="true">→</span> : null}
            </button>
            <button
              className={styles.secondary}
              type="button"
              onClick={cancelMission}
              disabled={decision !== "PENDING"}
            >
              {decision === "CANCELLING" ? "Cancelling…" : "Cancel mission"}
            </button>
          </div>

          {error ? <p className={styles.error}>{error}</p> : null}

          <div className={styles.safety}>
            <span className={styles.safetyMark}>✓</span>
            <span>
              Approval saves your choice only. SABI does not make a payment,
              purchase, booking or transfer at this checkpoint.
            </span>
          </div>
        </>
      ) : decision === "APPROVED" ? (
        <div className={styles.state}>
          <h2>Choice approved</h2>
          <p>
            Your decision for <strong>{selectedProvider.name}</strong> has been
            saved. SABI has stopped before any transaction.
          </p>
          <span className={styles.successBadge}>✓ Approval persisted</span>
          <div className={styles.safety}>
            <span className={styles.safetyMark}>✓</span>
            <span>No payment, booking, purchase or transfer was performed.</span>
          </div>
        </div>
      ) : (
        <div className={styles.state}>
          <h2>Mission cancelled</h2>
          <p>SABI has stopped this mission and will take no further action.</p>
          <span className={styles.cancelBadge}>Mission stopped</span>
        </div>
      )}
    </section>
  );
}

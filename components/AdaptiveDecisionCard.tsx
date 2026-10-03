"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./AdaptiveDecisionCard.module.css";

type AdaptiveDecisionCardProps = {
  missionId: string;
  quoteId: string;
  providerName: string;
  total: number;
  budget: number;
  untriedProviderCount: number;
};

type BusyAction = "accept" | "stop" | null;

export function AdaptiveDecisionCard({
  missionId,
  quoteId,
  providerName,
  total,
  budget,
  untriedProviderCount
}: AdaptiveDecisionCardProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [message, setMessage] = useState<string | null>(null);
  const gap = Math.max(total - budget, 0);

  if (untriedProviderCount > 0) {
    return (
      <section className={styles.card}>
        <div className={styles.eyebrow}>Adaptive sourcing</div>
        <h2>SABI is still looking for a better fit</h2>
        <p>
          {providerName} quoted <strong>₦{total.toLocaleString()}</strong>, above your
          ₦{budget.toLocaleString()} budget. There {untriedProviderCount === 1 ? "is" : "are"}{" "}
          <strong>{untriedProviderCount}</strong> untried eligible provider
          {untriedProviderCount === 1 ? "" : "s"}, so SABI will keep sourcing before
          asking you to relax your budget.
        </p>
        <div className={styles.safety}>Your budget stays unchanged while SABI searches.</div>
      </section>
    );
  }

  async function acceptBestAvailable() {
    const confirmed = window.confirm(
      `Use the best available verified option at ₦${total.toLocaleString()}? This is ₦${gap.toLocaleString()} above your current budget. SABI will only move to the approval checkpoint — it will not book or pay.`
    );
    if (!confirmed) return;

    setBusyAction("accept");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/accept-best-available`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            quoteId,
            confirmation: "ACCEPT_OVER_BUDGET"
          })
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        status?: string;
        selectedTotal?: number;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "SABI could not apply that decision safely.");
      }

      setMessage(
        `Budget override confirmed. SABI moved the verified ₦${(result.selectedTotal ?? total).toLocaleString()} option to human approval — no booking or payment was made.`
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "SABI could not apply that decision safely."
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function keepBudgetAndStop() {
    const confirmed = window.confirm(
      `Keep your ₦${budget.toLocaleString()} budget and end this mission? SABI will not contact anyone else, book, purchase or pay.`
    );
    if (!confirmed) return;

    setBusyAction("stop");
    setMessage(null);

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/cancel`,
        { method: "POST" }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        missionStatus?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "SABI could not end the mission safely.");
      }

      setMessage(
        `No problem. Your ₦${budget.toLocaleString()} budget stays unchanged and SABI ended the mission without booking or payment.`
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "SABI could not end the mission safely."
      );
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className={styles.card}>
      <div className={styles.eyebrow}>Human decision</div>
      <h2>No vendor fits the current budget</h2>
      <p>
        SABI exhausted the currently eligible provider pool. The best verified option is{" "}
        <strong>{providerName}</strong> at <strong>₦{total.toLocaleString()}</strong>, which is{" "}
        <strong>₦{gap.toLocaleString()}</strong> above your ₦{budget.toLocaleString()} budget.
      </p>
      <div className={styles.actions}>
        <button type="button" onClick={acceptBestAvailable} disabled={busyAction !== null}>
          {busyAction === "accept" ? "Checking…" : `Use best available · ₦${total.toLocaleString()}`}
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={keepBudgetAndStop}
          disabled={busyAction !== null}
        >
          {busyAction === "stop" ? "Ending mission…" : `Never mind — keep my ₦${budget.toLocaleString()} budget`}
        </button>
      </div>
      <p className={styles.choiceNote}>
        Go above budget only if this is urgent. Otherwise, keep your original limit and end the mission with no commitment.
      </p>
      <div className={styles.safety}>No booking, purchase or payment happens from either action without a later approval step.</div>
      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}

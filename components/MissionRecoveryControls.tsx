"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { MissionStatus } from "../lib/schemas";

type MissionRecoveryControlsProps = {
  missionId: string;
  demoMode: boolean;
  status: MissionStatus;
  failedContactCount: number;
  unsettledContactCount: number;
  completedWithoutEvidenceCount: number;
  quoteCount: number;
  noQualifyingProvider: boolean;
  budget?: number;
  deadline?: string;
};

const STOPPED_STATUSES = new Set<MissionStatus>([
  "AWAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ESCALATED"
]);

export function MissionRecoveryControls({
  missionId,
  demoMode,
  status,
  failedContactCount,
  unsettledContactCount,
  completedWithoutEvidenceCount,
  quoteCount,
  noQualifyingProvider,
  budget,
  deadline
}: MissionRecoveryControlsProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [operatorToken, setOperatorToken] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.sessionStorage.getItem("sabi-operator-token");
    if (remembered) setOperatorToken(remembered);
  }, []);

  async function runSimulation() {
    setBusy(true);
    setMessage(null);

    try {
      let finalReason = "Simulation advanced.";

      for (let index = 0; index < 12; index += 1) {
        const response = await fetch(
          `/api/missions/${encodeURIComponent(missionId)}/orchestrate`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "SIMULATION" })
          }
        );
        const result = (await response.json().catch(() => ({}))) as {
          error?: string;
          outcome?: "ADVANCED" | "WAITING" | "CHECKPOINT";
          reason?: string;
        };

        if (!response.ok) {
          throw new Error(result.error ?? "Simulation could not continue.");
        }

        finalReason = result.reason ?? finalReason;
        if (result.outcome === "CHECKPOINT" || result.outcome === "WAITING") {
          break;
        }
      }

      setMessage(
        finalReason === "AWAITING_HUMAN_APPROVAL"
          ? "Simulation reached the human approval checkpoint."
          : finalReason.replaceAll("_", " ").toLowerCase()
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Simulation could not continue."
      );
    } finally {
      setBusy(false);
    }
  }

  async function restartDemo() {
    if (!window.confirm("Restart this labelled simulation from the beginning?")) {
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/restart`,
        { method: "POST" }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "Demo could not be restarted.");
      }

      setMessage("Simulation restarted. No real provider was contacted.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Demo could not be restarted."
      );
    } finally {
      setBusy(false);
    }
  }

  async function continueWithSettledEvidence() {
    const token = operatorToken.trim();
    if (!token) {
      setMessage("Enter the supervised operator token to continue safely.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/continue`,
        {
          method: "POST",
          headers: { authorization: `Bearer ${token}` }
        }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        reason?: string;
        outcome?: string;
      };

      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem("sabi-operator-token");
        }
        throw new Error(result.error ?? "Mission could not continue.");
      }

      window.sessionStorage.setItem("sabi-operator-token", token);
      setMessage(
        result.reason === "AWAITING_HUMAN_APPROVAL"
          ? "SABI compared the settled evidence and reached human approval."
          : (result.reason ?? "Mission safely re-evaluated.").replaceAll("_", " ").toLowerCase()
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Mission could not continue."
      );
    } finally {
      setBusy(false);
    }
  }

  if (demoMode) {
    return (
      <section className="recoveryCard">
        <div className="recoveryHeader">
          <div>
            <div className="eyebrow">Hackathon controls</div>
            <h2>Run the labelled simulation</h2>
          </div>
          <span className="statusBadge warning">Simulation only</span>
        </div>
        <p>
          Use these controls to rehearse the complete SABI mission without calling,
          paying, booking or purchasing anything.
        </p>
        <div className="recoveryActions">
          {!STOPPED_STATUSES.has(status) ? (
            <button
              type="button"
              className="primaryAction"
              onClick={runSimulation}
              disabled={busy}
            >
              {busy ? "Running…" : "Run simulation"}
            </button>
          ) : null}
          <button
            type="button"
            className="secondaryAction"
            onClick={restartDemo}
            disabled={busy}
          >
            Restart demo
          </button>
          <a className="secondaryAction recoveryLink" href="/">
            New mission
          </a>
        </div>
        {message ? <p className="recoveryMessage">{message}</p> : null}
      </section>
    );
  }

  const showRecovery =
    failedContactCount > 0 ||
    unsettledContactCount > 0 ||
    completedWithoutEvidenceCount > 0 ||
    noQualifyingProvider;

  if (!showRecovery) return null;

  const canContinue =
    (status === "COLLECTING_QUOTES" || status === "COMPARING") &&
    unsettledContactCount === 0 &&
    completedWithoutEvidenceCount === 0 &&
    quoteCount > 0;

  return (
    <section className={`recoveryCard ${noQualifyingProvider ? "recoveryCardAlert" : ""}`}>
      <div className="eyebrow">Recovery</div>
      <h2>
        {noQualifyingProvider
          ? "No qualifying provider yet"
          : unsettledContactCount > 0
            ? "SABI is still waiting for provider contacts"
            : completedWithoutEvidenceCount > 0
              ? "Provider facts still need validation"
              : "Some providers could not be reached"}
      </h2>

      {noQualifyingProvider ? (
        <p>
          SABI did not silently relax your constraints. {budget !== undefined ? `The budget is ₦${budget.toLocaleString()}. ` : ""}
          {deadline ? `The deadline is ${deadline}. ` : ""}
          Review the rejected options below or start a new mission with different constraints.
        </p>
      ) : unsettledContactCount > 0 ? (
        <p>
          {unsettledContactCount} provider contact{unsettledContactCount === 1 ? " is" : "s are"} still active. SABI will not compare early just because one response arrived first.
        </p>
      ) : completedWithoutEvidenceCount > 0 ? (
        <p>
          {completedWithoutEvidenceCount} completed response{completedWithoutEvidenceCount === 1 ? " still needs" : "s still need"} factual evidence. Add only what the provider actually confirmed before comparison.
        </p>
      ) : (
        <p>
          {failedContactCount} provider contact{failedContactCount === 1 ? "" : "s"} ended without a usable response. SABI can continue with the valid settled evidence that remains.
        </p>
      )}

      {canContinue ? (
        <div className="operatorContinue">
          <label>
            Operator token
            <input
              type="password"
              value={operatorToken}
              onChange={(event) => setOperatorToken(event.target.value)}
              autoComplete="off"
              placeholder="SABI_OPERATOR_TOKEN"
            />
          </label>
          <button
            type="button"
            className="primaryAction"
            onClick={continueWithSettledEvidence}
            disabled={busy}
          >
            {busy ? "Checking…" : "Continue with settled responses"}
          </button>
        </div>
      ) : null}

      <div className="recoveryActions">
        <a className="secondaryAction recoveryLink" href="/">
          Start a new mission
        </a>
      </div>

      <p className="safetyNote">
        Recovery controls never approve, pay, purchase or book. The continue action cannot initiate a new provider call.
      </p>
      {message ? <p className="recoveryMessage">{message}</p> : null}
    </section>
  );
}

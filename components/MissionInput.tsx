"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CANONICAL_REQUEST =
  "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.";

type MissionMode = "SIMULATION" | "LIVE";

export function MissionInput() {
  const router = useRouter();
  const [request, setRequest] = useState(CANONICAL_REQUEST);
  const [mode, setMode] = useState<MissionMode>("SIMULATION");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = request.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/missions", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ request: trimmed, mode })
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.mission?.id) {
        throw new Error(
          result?.message ?? "SABI could not create this mission right now."
        );
      }

      router.push(`/mission/${encodeURIComponent(result.mission.id)}`);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "SABI could not create this mission right now."
      );
      setSubmitting(false);
    }
  }

  return (
    <form className="missionForm" onSubmit={handleSubmit}>
      <label htmlFor="mission-request">Describe your mission</label>
      <textarea
        id="mission-request"
        value={request}
        onChange={(event) => setRequest(event.target.value)}
        rows={5}
        placeholder="Tell SABI what you need, your budget, location, and deadline."
        disabled={submitting}
      />

      <fieldset className="missionModePicker" disabled={submitting}>
        <legend>Choose how to run this mission</legend>
        <label className={mode === "SIMULATION" ? "selected" : ""}>
          <input
            type="radio"
            name="mission-mode"
            value="SIMULATION"
            checked={mode === "SIMULATION"}
            onChange={() => setMode("SIMULATION")}
          />
          <span>
            <strong>Simulation rehearsal</strong>
            <small>Uses clearly labelled mock suppliers. No phone call is made.</small>
          </span>
        </label>
        <label className={mode === "LIVE" ? "selected" : ""}>
          <input
            type="radio"
            name="mission-mode"
            value="LIVE"
            checked={mode === "LIVE"}
            onChange={() => setMode("LIVE")}
          />
          <span>
            <strong>Live Voice Test</strong>
            <small>
              Creates a live mission only. Mission Control still requires the operator token and a consenting configured supplier before BimpeAI can call.
            </small>
          </span>
        </label>
      </fieldset>

      {mode === "LIVE" ? (
        <p className="liveModeNotice">
          Creating this mission does not call anyone. The external call happens only after you explicitly start the consent-gated Live Voice Test inside Mission Control.
        </p>
      ) : null}

      <button type="submit" disabled={submitting}>
        {submitting
          ? "Creating mission…"
          : mode === "LIVE"
            ? "Create live test mission"
            : "Create simulation mission"}
      </button>
      {error ? <p className="formError">{error}</p> : null}

      <style jsx>{`
        .missionModePicker {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin: 6px 0 0;
          padding: 0;
          border: 0;
        }

        .missionModePicker legend {
          grid-column: 1 / -1;
          margin-bottom: 2px;
          font-size: 0.82rem;
          font-weight: 800;
          color: #52525b;
        }

        .missionModePicker label {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-height: 102px;
          padding: 14px;
          border: 1px solid rgba(24, 24, 27, 0.1);
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.62);
          cursor: pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease, background 150ms ease;
        }

        .missionModePicker label.selected {
          border-color: #8c6bd6;
          box-shadow: inset 0 0 0 1px #8c6bd6;
          background: #f7f3ff;
        }

        .missionModePicker input {
          margin-top: 3px;
          accent-color: #6d4cc7;
        }

        .missionModePicker span {
          display: grid;
          gap: 4px;
        }

        .missionModePicker strong {
          font-size: 0.92rem;
        }

        .missionModePicker small {
          color: #71717a;
          font-size: 0.79rem;
          font-weight: 500;
          line-height: 1.45;
        }

        .liveModeNotice {
          margin: 0;
          padding: 11px 13px;
          border-radius: 13px;
          background: #fff4d8;
          color: #6b4d00;
          font-size: 0.82rem;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .missionModePicker {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </form>
  );
}

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
    </form>
  );
}

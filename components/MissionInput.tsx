"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const CANONICAL_REQUEST =
  "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.";

export function MissionInput() {
  const router = useRouter();
  const [request, setRequest] = useState(CANONICAL_REQUEST);
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
        body: JSON.stringify({ request: trimmed })
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
      <button type="submit" disabled={submitting}>
        {submitting ? "Creating mission…" : "Create mission"}
      </button>
      {error ? <p className="formError">{error}</p> : null}
    </form>
  );
}

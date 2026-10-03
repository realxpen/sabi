"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function MissionStartupRecovery({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function retry() {
    if (busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/retry-start`,
        { method: "POST" }
      );
      const result = (await response.json().catch(() => ({}))) as {
        error?: string;
        missionStatus?: string;
        providerCount?: number;
      };

      if (!response.ok) {
        throw new Error(result.error ?? "SABI could not retry this mission safely.");
      }

      setMessage(
        result.providerCount === 0
          ? "Mission resumed. SABI reached provider search, but no matching live provider is currently configured."
          : `Mission resumed at ${result.missionStatus ?? "the next safe stage"}.`
      );
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "SABI could not retry this mission safely."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        border: "1px solid rgba(168, 117, 37, 0.24)",
        background: "rgba(255, 249, 235, 0.92)",
        borderRadius: 18,
        padding: 18
      }}
    >
      <strong style={{ display: "block", marginBottom: 6 }}>
        Agent start did not complete
      </strong>
      <p style={{ margin: "0 0 12px", color: "#6f6558", lineHeight: 1.5 }}>
        Resume this same mission safely. SABI will not create a duplicate mission and this retry itself will not call, book or pay anyone.
      </p>
      <button
        type="button"
        onClick={retry}
        disabled={busy}
        style={{
          border: 0,
          borderRadius: 999,
          padding: "10px 16px",
          background: "#17151d",
          color: "white",
          fontWeight: 750,
          cursor: busy ? "progress" : "pointer",
          opacity: busy ? 0.6 : 1
        }}
      >
        {busy ? "Retrying…" : "Retry mission start"}
      </button>
      {message ? (
        <p style={{ margin: "12px 0 0", color: "#4f473d", fontSize: 13 }}>{message}</p>
      ) : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { MissionStatus } from "../lib/schemas";

const STOP_REFRESHING: ReadonlySet<MissionStatus> = new Set([
  "AWAITING_APPROVAL",
  "APPROVED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "ESCALATED"
]);

type MissionLiveRefreshProps = {
  missionId: string;
  status: MissionStatus;
  demoMode: boolean;
  intervalMs?: number;
};

export function MissionLiveRefresh({
  missionId,
  status,
  demoMode,
  intervalMs = 1400
}: MissionLiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (STOP_REFRESHING.has(status)) return;

    let cancelled = false;
    let inFlight = false;

    async function tick() {
      if (cancelled || inFlight) return;
      inFlight = true;

      try {
        if (demoMode) {
          await fetch(`/api/missions/${encodeURIComponent(missionId)}/orchestrate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ mode: "SIMULATION" })
          });
        }

        if (!cancelled) router.refresh();
      } finally {
        inFlight = false;
      }
    }

    void tick();
    const interval = window.setInterval(() => void tick(), intervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [demoMode, intervalMs, missionId, router, status]);

  return null;
}

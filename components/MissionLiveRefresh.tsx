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
  status: MissionStatus;
  intervalMs?: number;
};

export function MissionLiveRefresh({
  status,
  intervalMs = 3000
}: MissionLiveRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (STOP_REFRESHING.has(status)) return;

    const interval = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [intervalMs, router, status]);

  return null;
}

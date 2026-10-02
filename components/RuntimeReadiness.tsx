"use client";

import { useEffect, useState } from "react";

type RuntimeStatus = {
  environment: string;
  database: {
    configured: boolean;
    reachable: boolean;
    missionSnapshotsReady: boolean;
    communicationClaimsReady: boolean;
  };
  providerDirectory: {
    configured: boolean;
    providerCount: number;
    dialingNumbersExposed: boolean;
  };
  communication: {
    mode: string;
    consentedProviderPhoneCount: number;
    vapi: {
      apiBaseConfigured: boolean;
      apiKeyConfigured: boolean;
      assistantConfigured: boolean;
      sipTrunkConfigured: boolean;
      webhookAuthConfigured: boolean;
      configured: boolean;
    };
    liveReady: boolean;
  };
  bimpe: {
    apiKeyConfigured: boolean;
    agentConfigured: boolean;
    workflowConfigured: boolean;
    toolAuthConfigured: boolean;
    configured: boolean;
  };
  truthGuards: {
    humanApprovalRequired: boolean;
    transcriptAutoQuoteDisabled: boolean;
    noAnswerAutoQuoteDisabled: boolean;
    productionTransactionEnabled: boolean;
  };
};

function Flag({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{ok ? "Ready" : "Pending"}</strong>
    </div>
  );
}

export function RuntimeReadiness() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/internal/runtime-status", {
          cache: "no-store"
        });
        if (!response.ok) throw new Error("runtime status unavailable");
        const decoded = (await response.json()) as RuntimeStatus;
        if (!cancelled) setStatus(decoded);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (error) {
    return (
      <section className="panel">
        <div className="eyebrow">Runtime status unavailable</div>
        <h2>This screen is available only on a Vercel Preview deployment.</h2>
      </section>
    );
  }

  if (!status) {
    return (
      <section className="panel">
        <div className="eyebrow">Checking SABI</div>
        <h2>Reading integration readiness…</h2>
      </section>
    );
  }

  return (
    <div className="missionLayout">
      <section className="summaryCard">
        <div className="summaryHeader">
          <div>
            <div className="eyebrow">Runtime readiness</div>
            <h2>{status.communication.liveReady ? "Live communication ready" : "Pre-live build ready"}</h2>
          </div>
          <span className={`statusBadge ${status.communication.liveReady ? "success" : "warning"}`}>
            {status.environment}
          </span>
        </div>
        <div className="summaryGrid">
          <Flag ok={status.database.reachable} label="Neon database" />
          <Flag ok={status.database.missionSnapshotsReady} label="Mission storage" />
          <Flag ok={status.bimpe.toolAuthConfigured} label="Agent tool auth" />
          <Flag ok={status.communication.vapi.configured} label="Vapi runtime" />
        </div>
      </section>

      <section className="panel">
        <div className="eyebrow">Live communication gate</div>
        <h2>What is still needed for the real call</h2>
        <div className="summaryGrid">
          <Flag ok={status.providerDirectory.configured} label={`Test providers (${status.providerDirectory.providerCount})`} />
          <Flag ok={status.communication.consentedProviderPhoneCount > 0} label={`Consented phones (${status.communication.consentedProviderPhoneCount})`} />
          <Flag ok={status.communication.vapi.sipTrunkConfigured} label="SIP trunk" />
          <Flag ok={status.communication.vapi.webhookAuthConfigured} label="Webhook auth" />
        </div>
        <p className="safetyNote">
          Communication mode: {status.communication.mode}. Provider phone numbers are never returned by this status endpoint.
        </p>
      </section>

      <section className="panel">
        <div className="eyebrow">Safety gates</div>
        <h2>Consequential actions remain human-controlled</h2>
        <div className="summaryGrid">
          <Flag ok={status.truthGuards.humanApprovalRequired} label="Human approval" />
          <Flag ok={status.truthGuards.transcriptAutoQuoteDisabled} label="No transcript auto-Quote" />
          <Flag ok={status.truthGuards.noAnswerAutoQuoteDisabled} label="No-answer guard" />
          <Flag ok={!status.truthGuards.productionTransactionEnabled} label="No production transaction" />
        </div>
      </section>
    </div>
  );
}

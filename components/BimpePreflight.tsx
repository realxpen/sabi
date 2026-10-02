"use client";

import { useEffect, useState } from "react";

type PreflightResult = {
  message: string;
  canAttemptTestCall: boolean;
  externalActionPerformed: boolean;
  phoneNumbersExposed: boolean;
  secretsExposed: boolean;
  local: {
    communicationMode: string;
    bimpeSelected: boolean;
    apiBaseConfigured: boolean;
    apiBaseValid: boolean;
    apiKeyConfigured: boolean;
    apiKeyLooksValid: boolean;
    agentConfigured: boolean;
    workflowConfigured: boolean;
    testCallsEnabled: boolean;
    operatorAuthConfigured: boolean;
    agentToolAuthConfigured: boolean;
    providerDirectoryValid: boolean;
    providerCount: number;
    consentMapValid: boolean;
    consentedProviderMatchCount: number;
    consentedProviderMatchReady: boolean;
  };
  remote: {
    attempted: boolean;
    apiReachable: boolean;
    credentialsAccepted: boolean;
    agentVisible: boolean;
    configuredAgentName?: string;
    workflowMatches?: boolean | null;
    httpStatus?: number;
    reason?: string;
  };
};

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="preflightCheck">
      <div>
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <span className={`statusBadge ${ok ? "success" : "warning"}`}>
        {ok ? "Ready" : "Pending"}
      </span>
    </div>
  );
}

function readableReason(reason?: string) {
  if (!reason) return undefined;
  return reason.replaceAll("_", " ").toLowerCase();
}

export function BimpePreflight() {
  const [operatorToken, setOperatorToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PreflightResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const remembered = window.sessionStorage.getItem("sabi-operator-token");
    if (remembered) setOperatorToken(remembered);
  }, []);

  async function runPreflight() {
    const token = operatorToken.trim();
    if (!token) {
      setMessage("Enter the supervised operator token to run the no-call preflight.");
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/internal/bimpe-preflight", {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`
        }
      });
      const decoded = (await response.json().catch(() => ({}))) as
        | PreflightResult
        | { error?: string; message?: string };

      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem("sabi-operator-token");
        }
        throw new Error(
          "message" in decoded && decoded.message
            ? decoded.message
            : "error" in decoded && decoded.error
              ? decoded.error
              : "BimpeAI preflight could not run."
        );
      }

      window.sessionStorage.setItem("sabi-operator-token", token);
      setResult(decoded as PreflightResult);
      setMessage((decoded as PreflightResult).message);
    } catch (error) {
      setResult(null);
      setMessage(
        error instanceof Error ? error.message : "BimpeAI preflight could not run."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel preflightPanel">
      <div className="summaryHeader">
        <div>
          <div className="eyebrow">Tomorrow launch check</div>
          <h2>No-call BimpeAI preflight</h2>
        </div>
        <span className={`statusBadge ${result?.canAttemptTestCall ? "success" : "warning"}`}>
          {result?.canAttemptTestCall ? "Call-ready" : "Safe check"}
        </span>
      </div>

      <p className="lede preflightLede">
        Use this after adding the Preview environment variables. SABI verifies the
        selected Bimpe transport, provider/consent configuration and the configured
        Bimpe agent with read-only API access. This check cannot place a phone call.
      </p>

      <div className="preflightControls">
        <label>
          Supervised operator token
          <input
            type="password"
            value={operatorToken}
            onChange={(event) => setOperatorToken(event.target.value)}
            placeholder="SABI_OPERATOR_TOKEN"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="primaryAction"
          onClick={runPreflight}
          disabled={busy}
        >
          {busy ? "Checking…" : "Run no-call preflight"}
        </button>
      </div>

      {result ? (
        <div className="preflightResults">
          <div className="preflightGroup">
            <h3>Local configuration</h3>
            <Check
              ok={result.local.bimpeSelected}
              label="Bimpe selected transport"
              detail={`Current mode: ${result.local.communicationMode}`}
            />
            <Check
              ok={result.local.apiKeyConfigured && result.local.apiKeyLooksValid}
              label="Bimpe API key"
              detail="Presence and sk_ key shape only; the secret is never displayed."
            />
            <Check ok={result.local.agentConfigured} label="Bimpe voice agent ID" />
            <Check ok={result.local.workflowConfigured} label="Bimpe workflow ID" />
            <Check
              ok={result.local.testCallsEnabled}
              label="Safe test-call mode"
              detail="BIMPEAI_TEST_CALLS must remain true for the first proof."
            />
            <Check
              ok={result.local.operatorAuthConfigured}
              label="Operator authentication"
            />
            <Check
              ok={result.local.agentToolAuthConfigured}
              label="Agent-tool authentication"
            />
            <Check
              ok={result.local.providerDirectoryValid}
              label="Live perfume provider directory"
              detail={`${result.local.providerCount} configured provider${result.local.providerCount === 1 ? "" : "s"}`}
            />
            <Check
              ok={result.local.consentedProviderMatchReady}
              label="Provider ↔ consented phone match"
              detail={`${result.local.consentedProviderMatchCount} provider${result.local.consentedProviderMatchCount === 1 ? "" : "s"} have a matching consent record`}
            />
          </div>

          <div className="preflightGroup">
            <h3>Bimpe API verification</h3>
            <Check ok={result.remote.attempted} label="Read-only probe attempted" />
            <Check ok={result.remote.apiReachable} label="Bimpe API reachable" />
            <Check
              ok={result.remote.credentialsAccepted}
              label="API credential accepted"
            />
            <Check
              ok={result.remote.agentVisible}
              label="Configured agent visible"
              detail={result.remote.configuredAgentName}
            />
            {result.remote.workflowMatches !== null &&
            result.remote.workflowMatches !== undefined ? (
              <Check
                ok={result.remote.workflowMatches}
                label="Agent workflow matches configured workflow"
              />
            ) : null}
            {result.remote.reason ? (
              <p className="safetyNote">
                Diagnostic: {readableReason(result.remote.reason)}
                {result.remote.httpStatus
                  ? ` · HTTP ${result.remote.httpStatus}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className={`preflightVerdict ${result.canAttemptTestCall ? "ready" : "pending"}`}>
            <strong>
              {result.canAttemptTestCall
                ? "Ready for the first consent-gated BimpeAI test call"
                : "Do not call yet"}
            </strong>
            <span>
              {result.canAttemptTestCall
                ? "The configuration passed the no-call checks. The actual phone call still requires an explicit click in Mission Control."
                : "Fix the pending checks above, rerun this preflight, and only then use Live Voice Test in Mission Control."}
            </span>
          </div>
        </div>
      ) : null}

      <p className="safetyNote">
        Preflight performs no call, purchase, booking or payment and returns no API
        key, token or phone number.
      </p>
      {message ? <p className="recoveryMessage">{message}</p> : null}

      <style jsx>{`
        .preflightPanel {
          display: grid;
          gap: 18px;
        }

        .preflightLede {
          margin: 0;
        }

        .preflightControls {
          display: grid;
          grid-template-columns: minmax(240px, 1fr) max-content;
          gap: 12px;
          align-items: end;
        }

        .preflightControls label {
          display: grid;
          gap: 7px;
          font-size: 0.84rem;
          font-weight: 800;
          color: #3f3f46;
        }

        .preflightControls input {
          width: 100%;
          border: 1px solid rgba(24, 24, 27, 0.13);
          border-radius: 13px;
          padding: 11px 12px;
          background: white;
          color: #18181b;
          outline: none;
        }

        .preflightControls input:focus {
          border-color: #6d4cc7;
          box-shadow: 0 0 0 3px rgba(109, 76, 199, 0.1);
        }

        .preflightResults {
          display: grid;
          gap: 16px;
        }

        .preflightGroup {
          display: grid;
          gap: 9px;
          padding: 16px;
          border-radius: 16px;
          background: #f7f4ee;
        }

        .preflightGroup h3 {
          margin-bottom: 3px;
        }

        .preflightCheck {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          padding: 11px 0;
          border-bottom: 1px solid rgba(24, 24, 27, 0.07);
        }

        .preflightCheck:last-of-type {
          border-bottom: 0;
        }

        .preflightCheck > div {
          display: grid;
          gap: 3px;
        }

        .preflightCheck > div span {
          color: #71717a;
          font-size: 0.8rem;
          line-height: 1.4;
        }

        .preflightVerdict {
          display: grid;
          gap: 5px;
          padding: 16px;
          border-radius: 16px;
        }

        .preflightVerdict.ready {
          background: #e8f7ed;
          color: #245d38;
        }

        .preflightVerdict.pending {
          background: #fff4d8;
          color: #6b4d00;
        }

        .preflightVerdict span {
          line-height: 1.5;
          font-size: 0.86rem;
        }

        @media (max-width: 640px) {
          .preflightControls {
            grid-template-columns: 1fr;
          }

          .preflightControls :global(button) {
            width: 100%;
          }

          .preflightCheck {
            align-items: flex-start;
          }
        }
      `}</style>
    </section>
  );
}

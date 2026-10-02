"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CommunicationResult,
  MissionStatus,
  Provider,
  Quote
} from "../lib/schemas";

type LiveVoiceTestPanelProps = {
  missionId: string;
  demoMode: boolean;
  status: MissionStatus;
  providers: Provider[];
  communications: CommunicationResult[];
  quotes: Quote[];
};

type VoiceAction = "prepare" | "call" | "refresh" | "evidence";

type VoiceResponse = {
  error?: string;
  message?: string;
  missionStatus?: MissionStatus;
  readyToCall?: boolean;
  reason?: string;
  communication?: CommunicationResult;
  evidence?: {
    communicationId: string;
    callId: string;
    transcript: string;
    sourceReference: string;
    evidenceOnly: boolean;
    transcriptPersistedToMission: boolean;
    quoteCreated: boolean;
  };
};

function friendlyReason(value?: string) {
  if (!value) return undefined;
  return value.replaceAll("_", " ").toLowerCase();
}

export function LiveVoiceTestPanel({
  missionId,
  demoMode,
  status,
  providers,
  communications,
  quotes
}: LiveVoiceTestPanelProps) {
  const router = useRouter();
  const [operatorToken, setOperatorToken] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState(
    providers[0]?.id ?? ""
  );
  const [busyAction, setBusyAction] = useState<VoiceAction | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [transcriptCommunicationId, setTranscriptCommunicationId] = useState<
    string | null
  >(null);
  const pollingRef = useRef(false);

  useEffect(() => {
    const remembered = window.sessionStorage.getItem("sabi-operator-token");
    if (remembered) setOperatorToken(remembered);
  }, []);

  useEffect(() => {
    if (!selectedProviderId && providers[0]) {
      setSelectedProviderId(providers[0].id);
    }
  }, [providers, selectedProviderId]);

  const activeCommunication = useMemo(
    () =>
      communications.find(
        (communication) =>
          communication.status === "INITIATED" ||
          communication.status === "IN_PROGRESS"
      ),
    [communications]
  );

  const completedCommunication = useMemo(
    () =>
      communications.find(
        (communication) => communication.status === "COMPLETED"
      ),
    [communications]
  );

  const completedQuote = completedCommunication
    ? quotes.find(
        (quote) =>
          quote.providerId === completedCommunication.providerId &&
          quote.sourceReference ===
            (completedCommunication.externalId ?? completedCommunication.id)
      )
    : undefined;

  async function performAction(
    action: VoiceAction,
    extra: Record<string, string> = {},
    options: { quiet?: boolean } = {}
  ) {
    const token = operatorToken.trim();
    if (!token) {
      if (!options.quiet) {
        setMessage("Enter the supervised operator token before running a live voice action.");
      }
      return null;
    }

    if (!options.quiet) {
      setBusyAction(action);
      setMessage(null);
    }

    try {
      const response = await fetch(
        `/api/missions/${encodeURIComponent(missionId)}/live-voice-test`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ action, ...extra })
        }
      );
      const result = (await response.json().catch(() => ({}))) as VoiceResponse;

      if (!response.ok) {
        if (response.status === 401) {
          window.sessionStorage.removeItem("sabi-operator-token");
        }
        throw new Error(result.message ?? result.error ?? "Live Voice Test failed.");
      }

      window.sessionStorage.setItem("sabi-operator-token", token);

      if (action === "evidence" && result.evidence) {
        setTranscript(result.evidence.transcript);
        setTranscriptCommunicationId(result.evidence.communicationId);
        setMessage(
          "Transcript evidence loaded for review only. It has not been saved as a Quote."
        );
      } else if (!options.quiet) {
        if (action === "prepare") {
          setMessage(
            result.readyToCall
              ? "Live mission prepared. Select the consenting supplier and start the BimpeAI test call."
              : friendlyReason(result.reason) ?? "Live mission preparation paused safely."
          );
        } else if (action === "call") {
          setMessage(
            "BimpeAI call initiated. SABI is tracking the call; no order, payment or commitment was made."
          );
        } else if (action === "refresh") {
          setMessage(
            result.communication
              ? `Call status: ${result.communication.status.replaceAll("_", " ").toLowerCase()}.`
              : "Call status refreshed."
          );
        }
      }

      router.refresh();
      return result;
    } catch (error) {
      if (!options.quiet) {
        setMessage(
          error instanceof Error ? error.message : "Live Voice Test failed safely."
        );
      }
      return null;
    } finally {
      if (!options.quiet) setBusyAction(null);
    }
  }

  useEffect(() => {
    if (!activeCommunication || !operatorToken.trim()) return;

    let cancelled = false;

    async function poll() {
      if (cancelled || pollingRef.current) return;
      pollingRef.current = true;
      try {
        await performAction(
          "refresh",
          { communicationId: activeCommunication.id },
          { quiet: true }
        );
      } finally {
        pollingRef.current = false;
      }
    }

    const timer = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCommunication?.id, operatorToken, missionId]);

  if (demoMode) return null;

  const preContact = [
    "CREATED",
    "UNDERSTANDING",
    "PLANNING",
    "SEARCHING"
  ].includes(status);
  const canCall = status === "CONTACTING" && providers.length > 0;
  const needsEvidence = Boolean(
    completedCommunication && !completedQuote && status === "COLLECTING_QUOTES"
  );
  const voiceTestComplete =
    status === "AWAITING_APPROVAL" ||
    status === "APPROVED" ||
    status === "COMPLETED";

  return (
    <section className="liveVoiceCard">
      <div className="liveVoiceHeader">
        <div>
          <div className="eyebrow">BimpeAI Live Voice Test</div>
          <h2>
            {voiceTestComplete
              ? "Voice test reached the human-control checkpoint"
              : activeCommunication
                ? "Supplier call in progress"
                : needsEvidence
                  ? "Review what the supplier actually said"
                  : canCall
                    ? "Ready for one consented supplier call"
                    : "Prepare the live voice mission"}
          </h2>
        </div>
        <span className={`statusBadge ${voiceTestComplete ? "success" : "warning"}`}>
          {voiceTestComplete ? "Complete" : "Operator controlled"}
        </span>
      </div>

      <p className="liveVoiceIntro">
        This panel can place one BimpeAI test call to a separately configured,
        consenting provider. It never purchases, pays, books or promises payment.
      </p>

      {!voiceTestComplete ? (
        <label className="liveVoiceToken">
          Supervised operator token
          <input
            type="password"
            value={operatorToken}
            onChange={(event) => setOperatorToken(event.target.value)}
            autoComplete="off"
            placeholder="SABI_OPERATOR_TOKEN"
          />
        </label>
      ) : null}

      {preContact ? (
        <div className="liveVoiceActions">
          <button
            type="button"
            className="primaryAction"
            disabled={Boolean(busyAction)}
            onClick={() => void performAction("prepare")}
          >
            {busyAction === "prepare" ? "Preparing…" : "Prepare Live Voice Test"}
          </button>
          <span>
            Provider discovery is prepared first. This action cannot make a call.
          </span>
        </div>
      ) : null}

      {status === "SEARCHING" && providers.length === 0 ? (
        <p className="liveVoiceWarning">
          No configured live perfume supplier matched this mission yet. Add the
          consenting provider metadata before attempting a call.
        </p>
      ) : null}

      {canCall ? (
        <div className="liveProviderSelector">
          <label>
            Consenting supplier
            <select
              value={selectedProviderId}
              onChange={(event) => setSelectedProviderId(event.target.value)}
            >
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name} · {provider.location}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="primaryAction"
            disabled={!selectedProviderId || Boolean(busyAction)}
            onClick={() =>
              void performAction("call", { providerId: selectedProviderId })
            }
          >
            {busyAction === "call" ? "Starting call…" : "Call selected supplier"}
          </button>
          <p className="safetyNote">
            SABI resolves the phone number server-side from the consent mapping. The
            number is not stored in Mission state or displayed here.
          </p>
        </div>
      ) : null}

      {activeCommunication ? (
        <div className="liveCallState">
          <div>
            <strong>
              {activeCommunication.status === "INITIATED"
                ? "Calling supplier…"
                : "Supplier conversation active"}
            </strong>
            <span>
              {providers.find(
                (provider) => provider.id === activeCommunication.providerId
              )?.name ?? "Configured provider"}
            </span>
          </div>
          <button
            type="button"
            className="secondaryAction"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void performAction("refresh", {
                communicationId: activeCommunication.id
              })
            }
          >
            {busyAction === "refresh" ? "Checking…" : "Refresh call status"}
          </button>
          <p className="safetyNote">
            SABI also checks the Bimpe call state automatically while this screen is open.
          </p>
        </div>
      ) : null}

      {completedCommunication && !completedQuote ? (
        <div className="liveEvidenceStage">
          <div>
            <strong>Call completed</strong>
            <span>
              Retrieve the Bimpe conversation log, review it, then validate only
              the factual price, availability and delivery details below.
            </span>
          </div>
          <button
            type="button"
            className="secondaryAction"
            disabled={Boolean(busyAction)}
            onClick={() =>
              void performAction("evidence", {
                communicationId: completedCommunication.id
              })
            }
          >
            {busyAction === "evidence" ? "Retrieving…" : "Retrieve call evidence"}
          </button>
        </div>
      ) : null}

      {transcript && transcriptCommunicationId === completedCommunication?.id ? (
        <div className="transcriptEvidence">
          <div className="transcriptEvidenceHeader">
            <strong>Call transcript · evidence only</strong>
            <span>Not persisted as a Quote</span>
          </div>
          <pre>{transcript}</pre>
          <p>
            Use the factual evidence form in the provider contact card below. Leave
            anything the supplier did not explicitly confirm as unknown.
          </p>
        </div>
      ) : null}

      {completedQuote ? (
        <p className="liveVoiceSuccess">
          Provider facts were validated into a source-traceable Quote. SABI can now
          run deterministic comparison and stop at human approval.
        </p>
      ) : null}

      {voiceTestComplete ? (
        <p className="liveVoiceSuccess">
          Voice evidence has reached SABI&apos;s decision layer. Consequential action
          remains blocked until the human explicitly approves the recommendation.
        </p>
      ) : null}

      {message ? <p className="recoveryMessage">{message}</p> : null}
    </section>
  );
}

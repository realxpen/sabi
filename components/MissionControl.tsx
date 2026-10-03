import { recommend } from "../lib/intelligence";
import type { MissionSnapshot } from "../lib/mission/snapshot";
import { ApprovalCard } from "./ApprovalCard";
import { CommunicationActivity } from "./CommunicationActivity";
import { DecisionTrace } from "./DecisionTrace";
import { LiveVoiceTestPanel } from "./LiveVoiceTestPanel";
import { MissionExperience } from "./MissionExperience";
import { MissionRecoveryControls } from "./MissionRecoveryControls";
import { MissionSummary } from "./MissionSummary";
import { MissionTimeline } from "./MissionTimeline";
import { QuoteCard } from "./QuoteCard";

type MissionControlProps = {
  snapshot: MissionSnapshot;
};

export function MissionControl({ snapshot }: MissionControlProps) {
  const selectedQuote = snapshot.recommendation
    ? snapshot.quotes.find(
        (quote) => quote.id === snapshot.recommendation?.quoteId
      )
    : undefined;

  const selectedProvider = snapshot.recommendation
    ? snapshot.providers.find(
        (provider) => provider.id === snapshot.recommendation?.providerId
      )
    : undefined;

  const communicationLabel = snapshot.communications.every(
    (result) => result.channel === "MOCK"
  )
    ? "mock contacts"
    : "provider contacts";

  const intelligence =
    snapshot.providers.length > 0 && snapshot.quotes.length > 0
      ? recommend(snapshot.mission, snapshot.providers, snapshot.quotes)
      : undefined;

  const failedContactCount = snapshot.communications.filter((result) =>
    ["FAILED", "NO_ANSWER", "UNAVAILABLE"].includes(result.status)
  ).length;
  const unsettledContactCount = snapshot.communications.filter((result) =>
    ["INITIATED", "IN_PROGRESS"].includes(result.status)
  ).length;
  const completedWithoutEvidenceCount = snapshot.communications.filter(
    (result) =>
      result.channel !== "MOCK" &&
      result.status === "COMPLETED" &&
      !snapshot.quotes.some((quote) => quote.providerId === result.providerId)
  ).length;
  const noQualifyingProvider = Boolean(
    snapshot.mission.status === "COMPARING" &&
      intelligence &&
      !intelligence.selected
  );

  const approvalVisible = Boolean(
    snapshot.recommendation &&
      ["AWAITING_APPROVAL", "APPROVED", "COMPLETED"].includes(
        snapshot.mission.status
      )
  );

  return (
    <div className="missionLayout">
      <MissionExperience snapshot={snapshot} />

      {approvalVisible ? (
        <ApprovalCard
          mission={snapshot.mission}
          provider={selectedProvider}
          quote={selectedQuote}
        />
      ) : null}

      <details className="panel technicalDisclosure">
        <summary>
          <span>
            <strong>Technical details</strong>
            <small>Provider evidence, runtime controls and decision trace</small>
          </span>
          <span className="technicalChevron" aria-hidden="true">⌄</span>
        </summary>

        <div className="technicalStack">
          <div className="demoBanner">
            <strong>
              {snapshot.demoMode ? "Integration-safe demo mode" : "Integrated live mission"}
            </strong>
            <span>
              {snapshot.demoMode
                ? "This mission is using clearly labelled demo fixtures."
                : "Live provider actions remain consent-gated and operator-controlled."}
            </span>
          </div>

          <MissionSummary mission={snapshot.mission} />
          <MissionTimeline steps={snapshot.steps} />

          <LiveVoiceTestPanel
            missionId={snapshot.mission.id}
            demoMode={snapshot.demoMode}
            status={snapshot.mission.status}
            providers={snapshot.providers}
            communications={snapshot.communications}
            quotes={snapshot.quotes}
          />

          <CommunicationActivity
            communications={snapshot.communications}
            providers={snapshot.providers}
            quotes={snapshot.quotes}
          />

          <MissionRecoveryControls
            missionId={snapshot.mission.id}
            demoMode={snapshot.demoMode}
            status={snapshot.mission.status}
            failedContactCount={failedContactCount}
            unsettledContactCount={unsettledContactCount}
            completedWithoutEvidenceCount={completedWithoutEvidenceCount}
            quoteCount={snapshot.quotes.length}
            noQualifyingProvider={noQualifyingProvider}
            budget={snapshot.mission.budget}
            deadline={snapshot.mission.deadline}
          />

          <section className="resultsSection">
            <div className="sectionHeading">
              <div>
                <div className="eyebrow">Evidence</div>
                <h2>Provider responses</h2>
              </div>
              <span>
                {snapshot.quotes.length} responses · {snapshot.communications.length}{" "}
                {communicationLabel}
              </span>
            </div>

            <div className="quoteGrid">
              {snapshot.quotes.map((quote) => (
                <QuoteCard
                  key={quote.id}
                  quote={quote}
                  provider={snapshot.providers.find(
                    (provider) => provider.id === quote.providerId
                  )}
                  selected={quote.id === snapshot.recommendation?.quoteId}
                />
              ))}
            </div>
          </section>

          {intelligence ? (
            <DecisionTrace intelligence={intelligence} providers={snapshot.providers} />
          ) : null}
        </div>
      </details>

      <style>{`
        .technicalDisclosure {
          padding: 0;
          overflow: hidden;
        }

        .technicalDisclosure > summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 18px 22px;
          cursor: pointer;
          list-style: none;
          color: #4b4750;
        }

        .technicalDisclosure > summary::-webkit-details-marker {
          display: none;
        }

        .technicalDisclosure > summary > span:first-child {
          display: grid;
          gap: 3px;
        }

        .technicalDisclosure > summary strong {
          font-size: 0.92rem;
        }

        .technicalDisclosure > summary small {
          color: #8b8790;
          font-size: 0.76rem;
          font-weight: 550;
        }

        .technicalChevron {
          display: grid;
          place-items: center;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          background: #f1ede5;
          transition: transform 180ms ease;
        }

        .technicalDisclosure[open] .technicalChevron {
          transform: rotate(180deg);
        }

        .technicalStack {
          display: grid;
          gap: 18px;
          padding: 0 18px 18px;
          border-top: 1px solid rgba(24, 24, 27, 0.07);
          background: rgba(248, 246, 241, 0.45);
        }

        .technicalStack > :first-child {
          margin-top: 18px;
        }
      `}</style>
    </div>
  );
}

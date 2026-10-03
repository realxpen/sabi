import { recommend } from "../lib/intelligence";
import type { MissionSnapshot } from "../lib/mission/snapshot";
import { CommunicationActivity } from "./CommunicationActivity";
import { DecisionTrace } from "./DecisionTrace";
import { LiveVoiceTestPanel } from "./LiveVoiceTestPanel";
import { MissionRecoveryControls } from "./MissionRecoveryControls";
import { MissionSummary } from "./MissionSummary";
import { MissionTimeline } from "./MissionTimeline";
import { QuoteCard } from "./QuoteCard";

export function OperatorMissionTools({ snapshot }: { snapshot: MissionSnapshot }) {
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
    snapshot.mission.status === "COMPARING" && intelligence && !intelligence.selected
  );

  return (
    <div className="operatorWorkspace">
      <div className="operatorBanner">
        <div>
          <span className="operatorEyebrow">Internal workspace</span>
          <strong>Operator tools</strong>
          <p>Provider evidence, live-call controls, recovery actions and decision trace.</p>
        </div>
        <span className="operatorBadge">Not customer-facing</span>
      </div>

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

      <style>{`
        .operatorWorkspace {
          display: grid;
          gap: 18px;
        }

        .operatorBanner {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          padding: 22px 24px;
          border: 1px solid rgba(24, 24, 27, 0.1);
          border-radius: 24px;
          background: linear-gradient(135deg, #18181b, #2d2540);
          color: #fff;
          box-shadow: 0 24px 60px rgba(24, 24, 27, 0.14);
        }

        .operatorBanner > div {
          display: grid;
          gap: 6px;
        }

        .operatorEyebrow {
          color: #cfc4f6;
          font-size: 0.7rem;
          font-weight: 850;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .operatorBanner strong {
          font-size: clamp(1.35rem, 3vw, 2rem);
        }

        .operatorBanner p {
          margin: 0;
          max-width: 650px;
          color: #c9c6cf;
          line-height: 1.5;
        }

        .operatorBadge {
          flex: 0 0 auto;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 999px;
          padding: 8px 11px;
          background: rgba(255, 255, 255, 0.08);
          color: #e8e1ff;
          font-size: 0.72rem;
          font-weight: 800;
        }

        @media (max-width: 700px) {
          .operatorBanner {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  );
}

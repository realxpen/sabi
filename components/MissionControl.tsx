import { recommend } from "../lib/intelligence";
import type { MissionSnapshot } from "../lib/mission/snapshot";
import { ApprovalCard } from "./ApprovalCard";
import { CommunicationActivity } from "./CommunicationActivity";
import { DecisionTrace } from "./DecisionTrace";
import { LiveVoiceTestPanel } from "./LiveVoiceTestPanel";
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
        (provider) =>
          provider.id === snapshot.recommendation?.providerId
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

  return (
    <div className="missionLayout">
      <div className="demoBanner">
        <strong>
          {snapshot.demoMode ? "Integration-safe demo mode" : "Integrated live mission"}
        </strong>
        <span>
          {snapshot.demoMode
            ? "Mission Control is consuming the shared communication contract with demo fixtures. Live teammate outputs can replace the source without changing the UI architecture."
            : "This mission may use the operator-controlled BimpeAI Live Voice Test. A real call still requires explicit operator action and a separately configured consenting provider."}
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
            <div className="eyebrow">Results</div>
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

      {snapshot.recommendation ? (
        <section className="recommendationCard">
          <div className="eyebrow">Current recommendation</div>
          <h2>{selectedProvider?.name ?? "Selected provider"}</h2>
          <ul>
            {snapshot.recommendation.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <ApprovalCard
        mission={snapshot.mission}
        provider={selectedProvider}
        quote={selectedQuote}
      />
    </div>
  );
}

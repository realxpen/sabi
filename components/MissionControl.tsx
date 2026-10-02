import { recommend } from "../lib/intelligence";
import type { MissionSnapshot } from "../lib/mission/snapshot";
import { ApprovalCard } from "./ApprovalCard";
import { CommunicationActivity } from "./CommunicationActivity";
import { DecisionTrace } from "./DecisionTrace";
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

  return (
    <div className="missionLayout">
      <div className="demoBanner">
        <strong>
          {snapshot.demoMode ? "Integration-safe demo mode" : "Integrated mission"}
        </strong>
        <span>
          {snapshot.demoMode
            ? "Mission Control is consuming the shared communication contract with demo fixtures. Live teammate outputs can replace the source without changing the UI architecture."
            : "Mission Control is showing validated runtime outputs assembled through the shared SABI contracts. Human approval is still required before consequential action."}
        </span>
      </div>

      <MissionSummary mission={snapshot.mission} />
      <MissionTimeline steps={snapshot.steps} />
      <CommunicationActivity
        communications={snapshot.communications}
        providers={snapshot.providers}
        quotes={snapshot.quotes}
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

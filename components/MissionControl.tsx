import type { MissionSnapshot } from "../lib/mission/snapshot";
import { ApprovalCard } from "./ApprovalCard";
import { CommunicationActivity } from "./CommunicationActivity";
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

  return (
    <div className="missionLayout">
      <div className="demoBanner">
        <strong>Integration-safe demo mode</strong>
        <span>
          The screen now consumes the same normalized communication shape Lara's
          live adapter produces. Current provider responses are still demo
          fixtures until the live branch is integrated.
        </span>
      </div>

      <MissionSummary mission={snapshot.mission} />
      <MissionTimeline steps={snapshot.steps} />
      <CommunicationActivity
        communications={snapshot.communications}
        providers={snapshot.providers}
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

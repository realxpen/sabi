import type { MissionSnapshot } from "../lib/mission/snapshot";
import { ApprovalCard } from "./ApprovalCard";
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

  return (
    <div className="missionLayout">
      <div className="demoBanner">
        <strong>Phase 1 mock mode</strong>
        <span>
          Provider responses on this screen are controlled demo fixtures, not
          live vendor responses.
        </span>
      </div>

      <MissionSummary mission={snapshot.mission} />
      <MissionTimeline steps={snapshot.steps} />

      <section className="resultsSection">
        <div className="sectionHeading">
          <div>
            <div className="eyebrow">Results</div>
            <h2>Provider responses</h2>
          </div>
          <span>{snapshot.quotes.length} mock responses</span>
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

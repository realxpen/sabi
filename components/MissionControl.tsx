import type { MissionSnapshot } from "../lib/mission/snapshot";
import type { MissionStartupIssue } from "../lib/mission/startup-status";
import { AdaptiveDecisionCard } from "./AdaptiveDecisionCard";
import { ApprovalCard } from "./ApprovalCard";
import { MissionExperience } from "./MissionExperience";

type MissionControlProps = {
  snapshot: MissionSnapshot;
  startupIssue?: MissionStartupIssue | null;
};

function latestQuotesByProvider(snapshot: MissionSnapshot) {
  const latest = new Map<string, MissionSnapshot["quotes"][number]>();

  for (const quote of snapshot.quotes) {
    const existing = latest.get(quote.providerId);
    if (!existing || quote.createdAt >= existing.createdAt) {
      latest.set(quote.providerId, quote);
    }
  }

  return [...latest.values()];
}

export function MissionControl({ snapshot, startupIssue }: MissionControlProps) {
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

  const approvalVisible = Boolean(
    snapshot.recommendation &&
      ["AWAITING_APPROVAL", "APPROVED", "COMPLETED"].includes(
        snapshot.mission.status
      )
  );

  const latestQuotes = latestQuotesByProvider(snapshot);
  const budget = snapshot.mission.budget;
  const hasWithinBudget =
    budget !== undefined &&
    latestQuotes.some(
      (quote) => quote.available && quote.total !== undefined && quote.total <= budget
    );
  const hasUnknownTotal = latestQuotes.some(
    (quote) => quote.available && quote.total === undefined
  );
  const bestOverBudgetQuote =
    snapshot.mission.status === "COMPARING" &&
    !snapshot.recommendation &&
    budget !== undefined &&
    !hasWithinBudget &&
    !hasUnknownTotal
      ? latestQuotes
          .filter(
            (quote) => quote.available && quote.total !== undefined && quote.total > budget
          )
          .sort((a, b) => (a.total ?? Infinity) - (b.total ?? Infinity))[0]
      : undefined;

  const bestOverBudgetProvider = bestOverBudgetQuote
    ? snapshot.providers.find(
        (provider) => provider.id === bestOverBudgetQuote.providerId
      )
    : undefined;

  const contactedProviderIds = new Set(
    snapshot.communications.map((communication) => communication.providerId)
  );
  const untriedProviderCount = snapshot.providers.filter(
    (provider) => !contactedProviderIds.has(provider.id)
  ).length;

  return (
    <div className="missionLayout">
      <MissionExperience snapshot={snapshot} startupIssue={startupIssue} />

      {bestOverBudgetQuote && bestOverBudgetProvider && budget !== undefined && bestOverBudgetQuote.total !== undefined ? (
        <AdaptiveDecisionCard
          missionId={snapshot.mission.id}
          quoteId={bestOverBudgetQuote.id}
          providerName={bestOverBudgetProvider.name}
          total={bestOverBudgetQuote.total}
          budget={budget}
          untriedProviderCount={untriedProviderCount}
        />
      ) : null}

      {approvalVisible ? (
        <ApprovalCard
          mission={snapshot.mission}
          provider={selectedProvider}
          quote={selectedQuote}
        />
      ) : null}
    </div>
  );
}

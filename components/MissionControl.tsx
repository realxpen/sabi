import type { MissionSnapshot } from "../lib/mission/snapshot";
import type { MissionStartupIssue } from "../lib/mission/startup-status";
import { ApprovalCard } from "./ApprovalCard";
import { MissionExperience } from "./MissionExperience";

type MissionControlProps = {
  snapshot: MissionSnapshot;
  startupIssue?: MissionStartupIssue | null;
};

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

  return (
    <div className="missionLayout">
      <MissionExperience snapshot={snapshot} startupIssue={startupIssue} />

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

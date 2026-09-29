import type { Mission } from "../lib/schemas";
import { StatusBadge } from "./StatusBadge";

type MissionSummaryProps = {
  mission: Mission;
};

export function MissionSummary({ mission }: MissionSummaryProps) {
  return (
    <section className="summaryCard">
      <div className="summaryHeader">
        <div>
          <div className="eyebrow">Mission</div>
          <h2>{mission.item}</h2>
        </div>
        <StatusBadge label={mission.status.replaceAll("_", " ")} tone="warning" />
      </div>

      <div className="summaryGrid">
        <div>
          <span>Quantity</span>
          <strong>
            {mission.quantity ?? "Unknown"} {mission.unit ?? ""}
          </strong>
        </div>
        <div>
          <span>Budget</span>
          <strong>
            {mission.budget !== undefined
              ? `₦${mission.budget.toLocaleString()}`
              : "Unknown"}
          </strong>
        </div>
        <div>
          <span>Location</span>
          <strong>{mission.location ?? "Unknown"}</strong>
        </div>
        <div>
          <span>Deadline</span>
          <strong>{mission.deadline ?? "Unknown"}</strong>
        </div>
      </div>
    </section>
  );
}

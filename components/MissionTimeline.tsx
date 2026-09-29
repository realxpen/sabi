import type { MissionStep } from "../lib/schemas";

type MissionTimelineProps = {
  steps: MissionStep[];
};

export function MissionTimeline({ steps }: MissionTimelineProps) {
  return (
    <section className="timelineCard">
      <div className="eyebrow">Mission Control</div>
      <div className="timeline">
        {steps.map((step) => (
          <div
            className={`timelineItem ${step.status.toLowerCase()}`}
            key={step.id}
          >
            <span>
              {step.status === "COMPLETED"
                ? "✓"
                : step.status === "FAILED"
                  ? "×"
                  : "•"}
            </span>
            <div>
              <strong>{step.type.replaceAll("_", " ")}</strong>
              <p>{step.message}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

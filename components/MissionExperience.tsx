import type { MissionSnapshot } from "../lib/mission/snapshot";
import styles from "./MissionExperience.module.css";

const FLOW = [
  { label: "Understand", statuses: ["CREATED", "UNDERSTANDING", "PLANNING"] },
  { label: "Search", statuses: ["SEARCHING"] },
  { label: "Contact", statuses: ["CONTACTING"] },
  { label: "Verify", statuses: ["COLLECTING_QUOTES"] },
  { label: "Compare", statuses: ["COMPARING"] },
  { label: "Approve", statuses: ["AWAITING_APPROVAL", "APPROVED", "COMPLETED"] }
] as const;

function activeFlowIndex(status: MissionSnapshot["mission"]["status"]): number {
  if (["FAILED", "CANCELLED", "ESCALATED"].includes(status)) return -1;

  const direct = FLOW.findIndex((step) =>
    (step.statuses as readonly string[]).includes(status)
  );

  return direct >= 0 ? direct : 0;
}

function statusMessage(snapshot: MissionSnapshot): string {
  const { mission } = snapshot;

  switch (mission.status) {
    case "CREATED":
    case "UNDERSTANDING":
    case "PLANNING":
      return "Got it. I’m turning your request into a clear plan before I start looking.";
    case "SEARCHING":
      return "I’m looking for suitable providers that match what you asked for.";
    case "CONTACTING":
      return snapshot.providers.length > 0
        ? `I found ${snapshot.providers.length} provider${snapshot.providers.length === 1 ? "" : "s"}. I’m contacting them now.`
        : "I found possible providers and I’m reaching out for real availability and pricing.";
    case "COLLECTING_QUOTES":
      return "I’m verifying the important details from provider responses so I don’t recommend something based on guesses.";
    case "COMPARING":
      return snapshot.quotes.length > 0
        ? `I have ${snapshot.quotes.length} verified option${snapshot.quotes.length === 1 ? "" : "s"}. I’m comparing them against your budget, quantity and deadline.`
        : "I’m comparing the verified evidence against your mission constraints.";
    case "AWAITING_APPROVAL":
      return "I found an option that satisfies your current constraints. Review it below — I won’t commit or pay without you.";
    case "APPROVED":
      return "Your choice is approved. I’ve saved the decision and stopped before any transaction or payment.";
    case "COMPLETED":
      return "This mission is complete.";
    case "CANCELLED":
      return "This mission was cancelled. No further action will be taken.";
    case "FAILED":
      return "I couldn’t complete this mission safely, so I stopped without committing anything.";
    case "ESCALATED":
      return "This mission needs human attention before SABI can continue.";
    default:
      return "I’m working through your mission.";
  }
}

function progressTitle(status: MissionSnapshot["mission"]["status"]): string {
  switch (status) {
    case "CREATED":
    case "UNDERSTANDING":
    case "PLANNING":
      return "Understanding your request";
    case "SEARCHING":
      return "Finding the right providers";
    case "CONTACTING":
      return "Talking to providers";
    case "COLLECTING_QUOTES":
      return "Verifying what they said";
    case "COMPARING":
      return "Checking every constraint";
    case "AWAITING_APPROVAL":
      return "Ready for your decision";
    case "APPROVED":
      return "Choice approved";
    case "COMPLETED":
      return "Mission complete";
    case "CANCELLED":
      return "Mission cancelled";
    case "FAILED":
      return "Mission needs attention";
    case "ESCALATED":
      return "Human review needed";
    default:
      return "Mission in progress";
  }
}

export function MissionExperience({ snapshot }: { snapshot: MissionSnapshot }) {
  const { mission } = snapshot;
  const flowIndex = activeFlowIndex(mission.status);
  const terminal = ["APPROVED", "COMPLETED", "FAILED", "CANCELLED", "ESCALATED"].includes(
    mission.status
  );

  const selectedProvider = snapshot.recommendation
    ? snapshot.providers.find(
        (provider) => provider.id === snapshot.recommendation?.providerId
      )
    : undefined;
  const selectedQuote = snapshot.recommendation
    ? snapshot.quotes.find((quote) => quote.id === snapshot.recommendation?.quoteId)
    : undefined;

  const progressPercent =
    flowIndex < 0 ? 100 : Math.round(((flowIndex + (terminal ? 1 : 0.5)) / FLOW.length) * 100);

  return (
    <section className={styles.experience}>
      <div className={styles.conversationCard}>
        <div className={styles.conversationHeader}>
          <div className={styles.agentIdentity}>
            <div className={styles.agentMark}>S</div>
            <div>
              <strong>SABI</strong>
              <span>Your sourcing agent</span>
            </div>
          </div>
          <span className={`${styles.liveState} ${terminal ? styles.done : ""}`}>
            {terminal ? "Updated" : "Working"}
          </span>
        </div>

        <div className={styles.messages}>
          <div className={`${styles.messageRow} ${styles.user}`}>
            <div className={styles.messageBubble}>
              <span className={styles.messageLabel}>You</span>
              {mission.rawRequest}
            </div>
          </div>

          <div className={`${styles.messageRow} ${styles.assistant}`}>
            <div className={styles.messageBubble}>
              <span className={styles.messageLabel}>SABI</span>
              {statusMessage(snapshot)}
              {!terminal ? (
                <span className={styles.typing} aria-label="SABI is working">
                  <i />
                  <i />
                  <i />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <div>
            <span>Mission progress</span>
            <strong>{progressTitle(mission.status)}</strong>
          </div>
          <div className={styles.progressPercent}>{Math.min(progressPercent, 100)}%</div>
        </div>

        <div className={styles.progressTrack}>
          {FLOW.map((step, index) => {
            const complete = flowIndex > index || (terminal && flowIndex === index);
            const active = flowIndex === index && !terminal;
            return (
              <div
                key={step.label}
                className={`${styles.progressStep} ${complete ? styles.complete : ""} ${active ? styles.active : ""}`}
              >
                <span className={styles.stepDot}>{complete ? "✓" : index + 1}</span>
                <span>{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {selectedProvider && selectedQuote ? (
        <div className={styles.resultCard}>
          <div className={styles.resultEyebrow}>
            {mission.status === "APPROVED" ? "Approved choice" : "Best match"}
          </div>
          <div className={styles.resultHeader}>
            <div>
              <h2>{selectedProvider.name}</h2>
            </div>
            <div className={styles.resultTotal}>
              <strong>
                {selectedQuote.total !== undefined
                  ? `₦${selectedQuote.total.toLocaleString()}`
                  : "Total pending"}
              </strong>
              <span>verified all-in total</span>
            </div>
          </div>

          <div className={styles.factGrid}>
            <div className={styles.fact}>
              <span>Quantity</span>
              <strong>
                {selectedQuote.quantity !== undefined
                  ? `${selectedQuote.quantity} ${selectedQuote.unit ?? mission.unit ?? "units"}`
                  : mission.quantity !== undefined
                    ? `${mission.quantity} ${mission.unit ?? "units"}`
                    : "Confirmed"}
              </strong>
            </div>
            <div className={styles.fact}>
              <span>Delivery</span>
              <strong>{selectedQuote.deliveryDate ?? mission.deadline ?? "Confirmed"}</strong>
            </div>
            <div className={styles.fact}>
              <span>Location</span>
              <strong>{mission.location ?? selectedProvider.location}</strong>
            </div>
          </div>

          <div className={styles.evidenceRow}>
            <span className={styles.evidenceBadge}>Availability confirmed</span>
            {selectedQuote.quantity !== undefined ? (
              <span className={styles.evidenceBadge}>Quantity confirmed</span>
            ) : null}
            {selectedQuote.deliveryDate ? (
              <span className={styles.evidenceBadge}>Delivery confirmed</span>
            ) : null}
            {selectedQuote.source === "CALL" ? (
              <span className={styles.evidenceBadge}>Quote verified from call</span>
            ) : null}
          </div>
        </div>
      ) : !terminal ? (
        <div className={styles.pendingCard}>
          <strong>No decision needed from you yet.</strong>
          <p>SABI will surface the best verified option here when it is ready for your approval.</p>
        </div>
      ) : null}
    </section>
  );
}

import styles from "./NoProviderOutcome.module.css";

type NoProviderOutcomeProps = {
  request: string;
  location?: string;
};

export function NoProviderOutcome({ request, location }: NoProviderOutcomeProps) {
  return (
    <section className={styles.shell} aria-live="polite">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Search complete</span>
          <h2>No matching live provider found</h2>
        </div>
        <span className={styles.status}>Updated</span>
      </div>

      <div className={styles.requestCard}>
        <span>You asked</span>
        <strong>{request}</strong>
      </div>

      <p className={styles.explanation}>
        SABI checked the currently configured live provider network
        {location ? ` for ${location}` : ""}, but there is no eligible provider it can safely contact for this request right now.
      </p>

      <div className={styles.progress}>
        <div className={styles.done}><span>✓</span><small>Understand</small></div>
        <div className={styles.done}><span>✓</span><small>Search</small></div>
        <div><span>3</span><small>Contact</small></div>
        <div><span>4</span><small>Verify</small></div>
        <div><span>5</span><small>Compare</small></div>
        <div><span>6</span><small>Approve</small></div>
      </div>

      <div className={styles.safety}>
        No provider was contacted. No booking, purchase or payment was made.
      </div>

      <a className={styles.action} href="/">Start another mission</a>
    </section>
  );
}

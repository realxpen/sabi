import type { MissionSnapshot } from "../lib/mission/snapshot";
import styles from "./ProviderDiscoveryProof.module.css";

export function ProviderDiscoveryProof({ snapshot }: { snapshot: MissionSnapshot }) {
  if (snapshot.providers.length === 0) return null;

  const contactedProviderIds = new Set(
    snapshot.communications.map((communication) => communication.providerId)
  );

  return (
    <section className={styles.card} aria-label="Real provider discovery">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>LIVE PROVIDER SEARCH</span>
          <h2>Real matches from SABI’s provider registry</h2>
        </div>
        <span className={styles.count}>{snapshot.providers.length} found</span>
      </div>

      <div className={styles.providers}>
        {snapshot.providers.map((provider) => {
          const contacted = contactedProviderIds.has(provider.id);
          return (
            <article className={`${styles.provider} ${contacted ? styles.contacted : ""}`} key={provider.id}>
              <div className={styles.avatar} aria-hidden="true">
                {provider.name.slice(0, 1).toUpperCase()}
              </div>
              <div className={styles.meta}>
                <strong>{provider.name}</strong>
                <span>{provider.category} · {provider.location}</span>
                <small>{provider.languages.join(" · ")}</small>
              </div>
              <span className={contacted ? styles.callBadge : styles.candidateBadge}>
                {contacted ? "Selected for live call" : "Candidate"}
              </span>
            </article>
          );
        })}
      </div>

      <p className={styles.note}>
        Phone numbers stay private on the server. A provider is marked selected only after a persisted communication exists for that provider.
      </p>
    </section>
  );
}

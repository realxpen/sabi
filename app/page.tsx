import { MissionInput } from "../components/MissionInput";
import styles from "./home.module.css";

export default function HomePage() {
  return (
    <main className={`shell ${styles.page}`}>
      <section className={`hero ${styles.homeHero}`}>
        <nav className={styles.topbar} aria-label="SABI home navigation">
          <a href="/" className={styles.brand} aria-label="SABI home">
            <span className={styles.brandMark} aria-hidden="true">
              S
            </span>
            <span>SABI</span>
          </a>

          <a href="/vendors" className={styles.vendorLink}>
            <span aria-hidden="true">+</span>
            Vendors
          </a>
        </nav>

        <div className={styles.intro}>
          <div className={styles.kicker}>
            <span className={styles.statusDot} aria-hidden="true" />
            Your real-world AI agent
          </div>
          <h1>What do you need?</h1>
          <p>
            Tell SABI the outcome. It can find providers, call and verify the
            important details, compare real options, and wait for your approval.
          </p>
        </div>

        <div className={styles.composerWrap}>
          <MissionInput />
        </div>

        <div className={styles.trustRow} aria-label="SABI safeguards">
          <span>
            <b aria-hidden="true">✓</b>
            Real provider sourcing
          </span>
          <span>
            <b aria-hidden="true">✓</b>
            Quote evidence checked
          </span>
          <span>
            <b aria-hidden="true">✓</b>
            You approve before commitment
          </span>
        </div>
      </section>
    </main>
  );
}

import { MissionInput } from "../components/MissionInput";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">SABI</div>
        <h1>What do you need?</h1>
        <p className="lede">
          Describe the outcome. SABI will turn it into a mission, find suitable
          providers, compare real options, and stop for your approval.
        </p>

        <MissionInput />

        <div className="suggestions" aria-label="Example missions">
          <span>Find me lunch</span>
          <span>Find a photographer</span>
          <span>Buy something locally</span>
          <span>Find someone to fix something</span>
        </div>

        <p className="safetyNote">
          Builder preview: <a href="/readiness">check integration readiness</a>.
        </p>
      </section>
    </main>
  );
}

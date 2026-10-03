import { MissionInput } from "../components/MissionInput";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 10
          }}
        >
          <div className="eyebrow" style={{ marginBottom: 0 }}>
            SABI
          </div>
          <a href="/vendors" className="backLink">
            + Add vendor
          </a>
        </div>

        <h1>What do you need?</h1>
        <p className="lede">
          Tell SABI the outcome. It can turn your request into a mission, find
          real options, verify the important details, compare them against your
          limits, and stop for your approval.
        </p>

        <MissionInput />
      </section>
    </main>
  );
}

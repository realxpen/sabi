import { MissionInput } from "../components/MissionInput";

export default function HomePage() {
  return (
    <main className="shell">
      <section className="hero">
        <div className="eyebrow">SABI</div>
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

import { BimpePreflight } from "../../components/BimpePreflight";
import { RuntimeReadiness } from "../../components/RuntimeReadiness";

export const dynamic = "force-dynamic";

export default function ReadinessPage() {
  return (
    <main className="shell">
      <header className="missionHeader">
        <div>
          <div className="eyebrow">SABI</div>
          <h1>Readiness</h1>
        </div>
        <a href="/" className="backLink">
          Back to SABI
        </a>
      </header>

      <p className="missionRequest">
        Preview-only integration status for the hackathon runtime. No API keys,
        tokens or phone numbers are displayed here.
      </p>

      <RuntimeReadiness />
      <div style={{ height: 18 }} />
      <BimpePreflight />
    </main>
  );
}

import { VendorManager } from "../../components/VendorManager";

export const dynamic = "force-dynamic";

export default function VendorsPage() {
  return (
    <main className="shell">
      <header className="missionHeader">
        <div>
          <div className="eyebrow">SABI</div>
          <h1>Live provider network</h1>
          <p className="lede">
            Add real consenting providers to SABI. Once they are live-ready,
            matching missions can discover and contact them for real.
          </p>
        </div>
        <a href="/" className="backLink">
          Back to SABI
        </a>
      </header>

      <VendorManager />
    </main>
  );
}

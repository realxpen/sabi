import { VendorManager } from "../../components/VendorManager";

export const dynamic = "force-dynamic";

export default function VendorsPage() {
  return (
    <main className="shell">
      <header className="missionHeader">
        <div>
          <div className="eyebrow">SABI</div>
          <h1>Vendors</h1>
          <p className="lede">
            Add a consenting provider once, then let SABI discover them in live
            missions without editing deployment configuration.
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

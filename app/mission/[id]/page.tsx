import { MissionControl } from "../../../components/MissionControl";
import { getMissionSnapshot } from "../../../lib/integrations/neon/mission-snapshot-repository";
import type { MissionSnapshot } from "../../../lib/mission/snapshot";

export const dynamic = "force-dynamic";

type MissionPageProps = {
  params: {
    id: string;
  };
};

export default async function MissionPage({ params }: MissionPageProps) {
  let snapshot: MissionSnapshot | null = null;
  let persistenceError = false;

  try {
    snapshot = await getMissionSnapshot(params.id);
  } catch (error) {
    console.error("Failed to load persisted mission page", error);
    persistenceError = true;
  }

  return (
    <main className="shell">
      <header className="missionHeader">
        <div>
          <div className="eyebrow">SABI</div>
          <h1>Mission Control</h1>
        </div>
        <a href="/" className="backLink">
          New mission
        </a>
      </header>

      {persistenceError ? (
        <section className="panel">
          <div className="eyebrow">Mission state unavailable</div>
          <h2>SABI could not load the persisted mission.</h2>
          <p className="lede">
            The mission database is not ready for this deployment yet. No live
            provider action was performed.
          </p>
        </section>
      ) : snapshot ? (
        <>
          <p className="missionRequest">{snapshot.mission.rawRequest}</p>
          <MissionControl snapshot={snapshot} />
        </>
      ) : (
        <section className="panel">
          <div className="eyebrow">Mission not found</div>
          <h2>This mission does not exist in persisted state.</h2>
          <p className="lede">
            Create a new mission so SABI can store it before opening Mission
            Control.
          </p>
        </section>
      )}
    </main>
  );
}

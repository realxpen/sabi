import { MissionControl } from "../../../components/MissionControl";
import { MissionLiveRefresh } from "../../../components/MissionLiveRefresh";
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
          <h1>Your mission</h1>
        </div>
        <a href="/" className="backLink">
          + New mission
        </a>
      </header>

      {persistenceError ? (
        <section className="panel">
          <div className="eyebrow">Mission unavailable</div>
          <h2>SABI could not load this mission.</h2>
          <p className="lede">
            Your mission state could not be loaded right now. No new provider
            action was performed.
          </p>
        </section>
      ) : snapshot ? (
        <>
          <MissionLiveRefresh
            missionId={snapshot.mission.id}
            status={snapshot.mission.status}
            demoMode={snapshot.demoMode}
          />
          <MissionControl snapshot={snapshot} />
        </>
      ) : (
        <section className="panel">
          <div className="eyebrow">Mission not found</div>
          <h2>This mission could not be found.</h2>
          <p className="lede">Start a new mission and SABI will take it from there.</p>
        </section>
      )}
    </main>
  );
}

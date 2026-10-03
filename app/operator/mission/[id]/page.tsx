import { MissionLiveRefresh } from "../../../../components/MissionLiveRefresh";
import { OperatorMissionTools } from "../../../../components/OperatorMissionTools";
import { getMissionSnapshot } from "../../../../lib/integrations/neon/mission-snapshot-repository";
import type { MissionSnapshot } from "../../../../lib/mission/snapshot";

export const dynamic = "force-dynamic";

type OperatorMissionPageProps = {
  params: {
    id: string;
  };
};

export default async function OperatorMissionPage({ params }: OperatorMissionPageProps) {
  let snapshot: MissionSnapshot | null = null;
  let persistenceError = false;

  try {
    snapshot = await getMissionSnapshot(params.id);
  } catch (error) {
    console.error("Failed to load operator mission workspace", error);
    persistenceError = true;
  }

  return (
    <main className="shell">
      <header className="missionHeader">
        <div>
          <div className="eyebrow">SABI · Internal</div>
          <h1>Mission operator workspace</h1>
        </div>
        <a
          href={`/mission/${encodeURIComponent(params.id)}`}
          className="backLink"
        >
          ← Customer view
        </a>
      </header>

      {persistenceError ? (
        <section className="panel">
          <div className="eyebrow">Mission unavailable</div>
          <h2>SABI could not load this mission.</h2>
          <p className="lede">
            Mission state could not be loaded right now. No provider action was performed.
          </p>
        </section>
      ) : snapshot ? (
        <>
          <MissionLiveRefresh
            missionId={snapshot.mission.id}
            status={snapshot.mission.status}
            demoMode={snapshot.demoMode}
          />
          <OperatorMissionTools snapshot={snapshot} />
        </>
      ) : (
        <section className="panel">
          <div className="eyebrow">Mission not found</div>
          <h2>This mission could not be found.</h2>
        </section>
      )}
    </main>
  );
}

import { MissionControl } from "../../../components/MissionControl";
import { buildDemoMissionSnapshot } from "../../../lib/mission/demo-engine";

type MissionPageProps = {
  params: {
    id: string;
  };
  searchParams?: {
    request?: string;
  };
};

export default function MissionPage({
  params,
  searchParams
}: MissionPageProps) {
  const request =
    searchParams?.request ??
    "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.";

  const snapshot = buildDemoMissionSnapshot(request, params.id);

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

      <p className="missionRequest">{request}</p>

      <MissionControl snapshot={snapshot} />
    </main>
  );
}

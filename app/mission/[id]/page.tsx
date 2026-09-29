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

  return (
    <main className="shell">
      <section className="panel">
        <div className="eyebrow">Mission Control</div>
        <h1>Mission {params.id}</h1>
        <p className="missionRequest">{request}</p>

        <div className="timeline" aria-label="Mission progress">
          <div className="timelineItem complete">
            <span>✓</span>
            <div>
              <strong>Request received</strong>
              <p>Shared contracts and state machine are ready.</p>
            </div>
          </div>

          <div className="timelineItem active">
            <span>•</span>
            <div>
              <strong>Foundation checkpoint</strong>
              <p>
                Provider search, communications, quote collection, and
                recommendation logic will plug into this mission flow next.
              </p>
            </div>
          </div>
        </div>

        <aside className="notice">
          Phase 1 foundation only. No external provider has been contacted and
          no financial action has been taken.
        </aside>
      </section>
    </main>
  );
}

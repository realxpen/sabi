import type { RecommendationResult } from "../lib/intelligence";
import type { Provider } from "../lib/schemas";

type DecisionTraceProps = {
  intelligence: RecommendationResult;
  providers: Provider[];
};

export function DecisionTrace({ intelligence, providers }: DecisionTraceProps) {
  if (!intelligence.selected && intelligence.exclusions.length === 0) return null;

  const providerName = (providerId: string) =>
    providers.find((provider) => provider.id === providerId)?.name ?? providerId;

  return (
    <section className="panel">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">Decision trace</div>
          <h2>Why SABI chose this option</h2>
        </div>
        <span>Deterministic · explainable</span>
      </div>

      {intelligence.selected ? (
        <div className="decisionBlock">
          <strong>{providerName(intelligence.selected.provider.id)} qualifies</strong>
          <ul>
            {intelligence.recommendationFactors.map((factor) => (
              <li key={factor}>{factor}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="lede">No provider currently satisfies all represented hard constraints.</p>
      )}

      {intelligence.exclusions.length > 0 ? (
        <div className="decisionExclusions">
          <div className="eyebrow">Rejected options</div>
          {intelligence.exclusions.map((exclusion) => (
            <div className="decisionExclusion" key={exclusion.quoteId}>
              <strong>{providerName(exclusion.providerId)}</strong>
              <ul>
                {exclusion.reasons.map((reason) => (
                  <li key={`${exclusion.quoteId}-${reason.code}`}>
                    {reason.message}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}

      <p className="evidenceNote">
        SABI is explaining the result from persisted provider and Quote data. Missing facts remain unknown; this section does not infer provider claims from transcript text.
      </p>
    </section>
  );
}

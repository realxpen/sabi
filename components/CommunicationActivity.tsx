import type { CommunicationResult, Provider } from "../lib/schemas";
import { StatusBadge } from "./StatusBadge";

type CommunicationActivityProps = {
  communications: CommunicationResult[];
  providers: Provider[];
};

function toneFor(status: CommunicationResult["status"]) {
  if (status === "COMPLETED") return "success" as const;
  if (
    status === "FAILED" ||
    status === "NO_ANSWER" ||
    status === "UNAVAILABLE"
  ) {
    return "warning" as const;
  }
  return "neutral" as const;
}

export function CommunicationActivity({
  communications,
  providers
}: CommunicationActivityProps) {
  if (communications.length === 0) return null;

  return (
    <section className="resultsSection">
      <div className="sectionHeading">
        <div>
          <div className="eyebrow">Communication</div>
          <h2>Provider contact activity</h2>
        </div>
        <span>{communications.length} contact results</span>
      </div>

      <div className="quoteGrid">
        {communications.map((result) => {
          const provider = providers.find(
            (candidate) => candidate.id === result.providerId
          );

          return (
            <article className="quoteCard" key={result.id}>
              <div className="quoteHeader">
                <div>
                  <h3>{provider?.name ?? "Provider"}</h3>
                  <p>
                    {result.summary ??
                      `${result.channel.toLowerCase()} result recorded by SABI.`}
                  </p>
                </div>
                <StatusBadge
                  label={result.status.replaceAll("_", " ")}
                  tone={toneFor(result.status)}
                />
              </div>

              <dl className="quoteFacts">
                <div>
                  <dt>Channel</dt>
                  <dd>{result.channel}</dd>
                </div>
                <div>
                  <dt>Quote evidence</dt>
                  <dd>{result.observation ? "Captured" : "Not captured"}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <p className="safetyNote">
        Communication status is evidence only. A completed call does not create a
        Quote unless factual quote fields are separately validated.
      </p>
    </section>
  );
}

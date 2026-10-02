import type {
  CommunicationResult,
  Provider,
  Quote
} from "../lib/schemas";
import { StatusBadge } from "./StatusBadge";
import { SupervisedEvidenceCapture } from "./SupervisedEvidenceCapture";

type CommunicationActivityProps = {
  communications: CommunicationResult[];
  providers: Provider[];
  quotes: Quote[];
};

function toneFor(status: CommunicationResult["status"], quoteValidated: boolean) {
  if (quoteValidated) return "success" as const;
  if (status === "COMPLETED") return "warning" as const;
  if (
    status === "FAILED" ||
    status === "NO_ANSWER" ||
    status === "UNAVAILABLE"
  ) {
    return "warning" as const;
  }
  return "neutral" as const;
}

function contactLabel(
  result: CommunicationResult,
  quoteValidated: boolean
): string {
  if (quoteValidated) return "Quote validated";

  switch (result.status) {
    case "INITIATED":
      return "Calling";
    case "IN_PROGRESS":
      return "In conversation";
    case "COMPLETED":
      return result.observation ? "Evidence captured" : "Needs evidence";
    case "NO_ANSWER":
      return "No answer";
    case "UNAVAILABLE":
      return "Unavailable";
    case "FAILED":
      return "Call failed";
  }
}

export function CommunicationActivity({
  communications,
  providers,
  quotes
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

      <div className="contactGrid">
        {communications.map((result) => {
          const provider = providers.find(
            (candidate) => candidate.id === result.providerId
          );
          const evidenceReference = result.externalId ?? result.id;
          const quote = quotes.find(
            (candidate) =>
              candidate.providerId === result.providerId &&
              candidate.sourceReference === evidenceReference
          );
          const quoteValidated = Boolean(quote);
          const canCaptureEvidence =
            result.status === "COMPLETED" &&
            result.channel !== "MOCK" &&
            !quoteValidated;

          return (
            <article
              className={`contactCard ${quoteValidated ? "validated" : ""}`}
              key={result.id}
            >
              <div className="quoteHeader">
                <div>
                  <h3>{provider?.name ?? "Provider"}</h3>
                  <p>
                    {result.summary ??
                      `${result.channel.toLowerCase()} result recorded by SABI.`}
                  </p>
                </div>
                <StatusBadge
                  label={contactLabel(result, quoteValidated)}
                  tone={toneFor(result.status, quoteValidated)}
                />
              </div>

              <dl className="quoteFacts">
                <div>
                  <dt>Channel</dt>
                  <dd>{result.channel}</dd>
                </div>
                <div>
                  <dt>Contact status</dt>
                  <dd>{result.status.replaceAll("_", " ")}</dd>
                </div>
                <div>
                  <dt>Factual evidence</dt>
                  <dd>{result.observation ? "Captured" : "Pending"}</dd>
                </div>
                <div>
                  <dt>Canonical Quote</dt>
                  <dd>{quoteValidated ? "Validated" : "Not created"}</dd>
                </div>
              </dl>

              {result.observation ? (
                <div className="evidenceSummary">
                  <strong>Provider-confirmed facts</strong>
                  <span>
                    Availability: {result.observation.available === undefined
                      ? "Unknown"
                      : result.observation.available
                        ? "Yes"
                        : "No"}
                  </span>
                  {result.observation.price !== undefined ? (
                    <span>Price: ₦{result.observation.price.toLocaleString()}</span>
                  ) : null}
                  {result.observation.deliveryFee !== undefined ? (
                    <span>
                      Delivery fee: ₦{result.observation.deliveryFee.toLocaleString()}
                    </span>
                  ) : null}
                  {result.observation.deliveryDate ? (
                    <span>Delivery: {result.observation.deliveryDate}</span>
                  ) : null}
                </div>
              ) : null}

              {canCaptureEvidence ? (
                <SupervisedEvidenceCapture
                  missionId={result.missionId}
                  communicationId={result.id}
                  providerName={provider?.name ?? "the provider"}
                />
              ) : null}

              {result.status === "NO_ANSWER" ? (
                <p className="contactNotice">
                  Provider did not answer. SABI will not create a Quote from this
                  contact.
                </p>
              ) : null}

              {result.status === "FAILED" ? (
                <p className="contactNotice">
                  Contact failed. Other provider results remain usable; no Quote
                  was fabricated.
                </p>
              ) : null}
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

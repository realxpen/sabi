import type { Provider, Quote } from "../lib/schemas";
import { StatusBadge } from "./StatusBadge";

type QuoteCardProps = {
  quote: Quote;
  provider?: Provider;
  selected?: boolean;
};

export function QuoteCard({
  quote,
  provider,
  selected = false
}: QuoteCardProps) {
  return (
    <article className={`quoteCard ${selected ? "selected" : ""}`}>
      <div className="quoteHeader">
        <div>
          <h3>{provider?.name ?? quote.providerId}</h3>
          <p>{provider?.location ?? "Location unavailable"}</p>
        </div>
        <StatusBadge
          label={quote.available ? "Available" : "Unavailable"}
          tone={quote.available ? "success" : "neutral"}
        />
      </div>

      <dl className="quoteFacts">
        <div>
          <dt>Item</dt>
          <dd>
            {quote.price !== undefined
              ? `₦${quote.price.toLocaleString()}`
              : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Delivery</dt>
          <dd>
            {quote.deliveryFee !== undefined
              ? `₦${quote.deliveryFee.toLocaleString()}`
              : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>
            {quote.total !== undefined
              ? `₦${quote.total.toLocaleString()}`
              : "Unknown"}
          </dd>
        </div>
        <div>
          <dt>When</dt>
          <dd>{quote.deliveryDate ?? "Unknown"}</dd>
        </div>
      </dl>

      {quote.notes ? <p className="quoteNote">{quote.notes}</p> : null}
    </article>
  );
}

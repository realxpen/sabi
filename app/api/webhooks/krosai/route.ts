import {
  createKrosWebhookPostHandlerWithNeonDedupe,
  unconfiguredKrosWebhookRuntimeDependencies
} from "../../../../lib/integrations/communication/kros-webhook-handler";

export const runtime = "nodejs";

/**
 * Production route fails closed until the verified Kros signature algorithm,
 * live envelope parser, correlation store and adapter are supplied.
 *
 * Event idempotency is already wired to durable Neon/Postgres storage and
 * never falls back to process memory on the deployed route.
 */
export const POST = createKrosWebhookPostHandlerWithNeonDedupe(
  unconfiguredKrosWebhookRuntimeDependencies
);

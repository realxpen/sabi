import {
  createKrosWebhookPostHandler,
  unconfiguredKrosWebhookDependencies
} from "../../../../lib/integrations/communication/kros-webhook-handler";

export const runtime = "nodejs";

/**
 * Production route fails closed until the verified Kros signature algorithm,
 * live envelope parser, correlation store, durable deduplicator, and adapter
 * are supplied.
 */
export const POST = createKrosWebhookPostHandler(
  unconfiguredKrosWebhookDependencies
);

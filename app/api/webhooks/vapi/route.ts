import { persistVerifiedVapiEventIntelligence } from "../../../../lib/integrations/communication/vapi-intelligence-persistence";
import { createVapiWebhookPostHandler } from "../../../../lib/integrations/communication/vapi-webhook-handler";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return createVapiWebhookPostHandler(
    process.env,
    fetch,
    undefined,
    persistVerifiedVapiEventIntelligence
  )(request);
}

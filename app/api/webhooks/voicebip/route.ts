import { createVoicebipWebhookPostHandler } from "../../../../lib/integrations/communication/voicebip-webhook-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createVoicebipWebhookPostHandler();

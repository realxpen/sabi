import { handleBimpeToolRequest } from "../../../../lib/integrations/bimpe/tool-bridge";
import { createConfiguredMessageTransport } from "../../../../lib/integrations/communication/message-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleBimpeToolRequest(request, "sendMessage", {
    messageTransport: createConfiguredMessageTransport()
  });
}

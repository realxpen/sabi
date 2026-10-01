import { handleBimpeToolRequest } from "../../../../lib/integrations/bimpe/tool-bridge";
import { createConfiguredCommunicationAdapter } from "../../../../lib/integrations/communication/live-runtime";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleBimpeToolRequest(request, "callProvider", {
    communicationAdapter: createConfiguredCommunicationAdapter()
  });
}

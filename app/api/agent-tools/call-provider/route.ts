import { handleBimpeToolRequest } from "../../../../lib/integrations/bimpe/tool-bridge";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleBimpeToolRequest(request, "callProvider");
}

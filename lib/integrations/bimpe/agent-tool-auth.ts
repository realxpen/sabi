import { timingSafeEqual } from "node:crypto";

export function authorizeAgentToolRequest(request: Request): Response | undefined {
  const expected = process.env.SABI_AGENT_TOOL_TOKEN?.trim();

  if (!expected) {
    return Response.json(
      { error: "AGENT_TOOL_AUTH_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const presented = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  if (!presented) {
    return Response.json(
      { error: "UNAUTHORIZED_AGENT_TOOL_REQUEST" },
      { status: 401 }
    );
  }

  const expectedBytes = Buffer.from(expected);
  const presentedBytes = Buffer.from(presented);

  if (
    expectedBytes.length !== presentedBytes.length ||
    !timingSafeEqual(expectedBytes, presentedBytes)
  ) {
    return Response.json(
      { error: "UNAUTHORIZED_AGENT_TOOL_REQUEST" },
      { status: 401 }
    );
  }

  return undefined;
}

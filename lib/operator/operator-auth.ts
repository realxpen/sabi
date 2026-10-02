import { timingSafeEqual } from "node:crypto";

function safeEquals(actual: string, expected: string): boolean {
  const actualBytes = Buffer.from(actual);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
}

export function authorizeOperatorRequest(request: Request): Response | undefined {
  const expected = process.env.SABI_OPERATOR_TOKEN?.trim();

  if (!expected) {
    return Response.json(
      { error: "OPERATOR_AUTH_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  const presented = request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim();

  if (!presented || !safeEquals(presented, expected)) {
    return Response.json({ error: "UNAUTHORIZED_OPERATOR" }, { status: 401 });
  }

  return undefined;
}

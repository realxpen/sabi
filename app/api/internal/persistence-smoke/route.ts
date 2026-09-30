import { randomUUID } from "node:crypto";
import { handleBimpeToolRequest } from "../../../../lib/integrations/bimpe/tool-bridge";

function internalRequest(path: string, token: string, body: unknown): Request {
  return new Request(`https://sabi.internal${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function runSmoke(): Promise<Response> {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== "lara/agent-tools"
  ) {
    return new Response(null, { status: 404 });
  }

  const token = process.env.SABI_AGENT_TOOL_TOKEN?.trim();
  if (!token) {
    return Response.json({ error: "AGENT_TOOL_AUTH_NOT_CONFIGURED" }, { status: 503 });
  }

  const runId = randomUUID();
  const missionId = `preview-smoke-${runId}`;
  const providerId = "provider-ade-textiles";

  const quoteResponse = await handleBimpeToolRequest(
    internalRequest("/api/agent-tools/record-quote", token, {
      missionId,
      providerId,
      available: true,
      price: 60000,
      deliveryFee: 3000,
      total: 63000,
      deliveryDate: "preview-smoke-test",
      notes: "Preview persistence smoke test; no real provider was contacted.",
      source: "MANUAL",
      sourceReference: `preview-smoke-${runId}`
    }),
    "recordQuote"
  );

  const quotePayload = await quoteResponse.json();
  if (!quoteResponse.ok) {
    return Response.json(
      { stage: "recordQuote", status: quoteResponse.status, result: quotePayload },
      { status: 500 }
    );
  }

  const quoteId = quotePayload?.data?.id;
  if (typeof quoteId !== "string" || !quoteId) {
    return Response.json({ stage: "recordQuote", error: "QUOTE_ID_MISSING" }, { status: 500 });
  }

  const approvalResponse = await handleBimpeToolRequest(
    internalRequest("/api/agent-tools/request-approval", token, {
      missionId,
      quoteId,
      providerId
    }),
    "requestApproval"
  );

  const approvalPayload = await approvalResponse.json();
  if (!approvalResponse.ok) {
    return Response.json(
      {
        stage: "requestApproval",
        status: approvalResponse.status,
        quoteId,
        result: approvalPayload
      },
      { status: 500 }
    );
  }

  return Response.json({
    ok: true,
    missionId,
    quoteId,
    approvalId: approvalPayload?.data?.id,
    quotePersisted: quotePayload?.meta?.persisted === true,
    approvalPersisted: approvalPayload?.meta?.approvalPersisted === true,
    quoteLoadedFromRepository:
      approvalPayload?.meta?.quoteLoadedFromRepository === true,
    transactionCommitted: approvalPayload?.meta?.transactionCommitted === true
  });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get("run") !== "quote-approval-smoke") {
    return new Response(null, { status: 404 });
  }

  return runSmoke();
}

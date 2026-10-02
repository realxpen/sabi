export const bimpeToolManifest = [
  {
    name: "searchProviders",
    method: "POST",
    path: "/api/agent-tools/search-providers",
    purpose: "Find provider candidates. Simulation fixtures only until a verified live directory exists."
  },
  {
    name: "getProvider",
    method: "POST",
    path: "/api/agent-tools/get-provider",
    purpose: "Fetch one provider by canonical provider ID."
  },
  {
    name: "callProvider",
    method: "POST",
    path: "/api/agent-tools/call-provider",
    purpose: "Initiate exactly one consent-gated provider call through the configured live communication adapter and persist the CommunicationResult."
  },
  {
    name: "refreshCommunication",
    method: "POST",
    path: "/api/agent-tools/refresh-communication",
    purpose: "Poll the configured call transport for the latest persisted provider-call status without creating a Quote."
  },
  {
    name: "getCommunicationEvidence",
    method: "POST",
    path: "/api/agent-tools/get-communication-evidence",
    purpose: "Retrieve authenticated transcript evidence for one completed correlated BimpeAI or Vapi call without persisting the transcript or creating a Quote."
  },
  {
    name: "recordProviderResponse",
    method: "POST",
    path: "/api/agent-tools/record-provider-response",
    purpose: "Convert already-extracted factual fields from one completed correlated communication into a traceable Quote."
  },
  {
    name: "recordQuote",
    method: "POST",
    path: "/api/agent-tools/record-quote",
    purpose: "Persist a validated Quote with source-reference evidence."
  },
  {
    name: "compareQuotes",
    method: "POST",
    path: "/api/agent-tools/compare-quotes",
    purpose: "Run deterministic hard-constraint filtering and ranking over persisted Quotes."
  },
  {
    name: "orchestrateMission",
    method: "POST",
    path: "/api/agent-tools/orchestrate-mission",
    purpose: "Advance exactly one safe persisted Mission stage. Live mode remains authenticated and communication-gated."
  },
  {
    name: "requestApproval",
    method: "POST",
    path: "/api/agent-tools/request-approval",
    purpose: "Move a recommended mission to the human approval checkpoint without executing a transaction."
  }
] as const;

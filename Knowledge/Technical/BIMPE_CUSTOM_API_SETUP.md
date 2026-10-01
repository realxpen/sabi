# SABI — Bimpe Custom API Setup

Status: READY FOR ACCOUNT CONFIGURATION

This file describes the SABI HTTP surface that can be registered as bounded Custom API actions in BimpeAI. It documents SABI's implemented contracts only. It does not assume an unverified Bimpe dashboard/import schema.

## Base URL

Use the deployed SABI Preview URL selected for the hackathon integration.

Do not point Bimpe at localhost.

Conceptually:

```text
https://<sabi-preview-domain>
```

## Authentication

All bounded agent-tool actions require:

```http
Authorization: Bearer <SABI_AGENT_TOOL_TOKEN>
Content-Type: application/json
```

Store the token in Bimpe/deployment secret configuration. Do not paste the real token into GitHub, screenshots, chat, or Knowledge documents.

## Live test-provider configuration

The hackathon live path uses two separate server-side variables:

```text
SABI_LIVE_TEST_PROVIDERS_JSON
SABI_CONSENTED_PROVIDER_PHONES_JSON
```

`SABI_LIVE_TEST_PROVIDERS_JSON` contains only canonical provider metadata and deliberately forbids phone numbers.

Example shape:

```json
[
  {
    "id": "provider-consented-fabric",
    "name": "Consented Fabric Test Provider",
    "category": "Fabric",
    "location": "Lagos",
    "languages": ["English"],
    "verified": false,
    "active": true
  }
]
```

The actual consenting E.164 dialing number remains only in `SABI_CONSENTED_PROVIDER_PHONES_JSON`, keyed by the same provider ID. Bimpe never needs that phone value.

## 1. Search Providers

```text
POST /api/agent-tools/search-providers
```

Request:

```json
{
  "mode": "SIMULATION",
  "query": "fabric",
  "category": "Fabric",
  "location": "Yaba",
  "verified": true,
  "active": true
}
```

All filter fields except `mode` are optional. `mode` defaults to `SIMULATION`.

Current behavior:

- `SIMULATION` returns explicitly labelled demo provider fixtures.
- `LIVE` returns only metadata from `SABI_LIVE_TEST_PROVIDERS_JSON`.
- if no live metadata directory is configured, `LIVE` returns `LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED`;
- live provider responses are labelled `configured-live-test-provider-metadata`;
- dialing numbers are never returned;
- the backend never silently returns demo providers as live providers.

## 2. Get Provider

```text
POST /api/agent-tools/get-provider
```

Request:

```json
{
  "providerId": "provider-ade-textiles",
  "mode": "SIMULATION"
}
```

Current behavior follows the same simulation/live boundary as provider search. A configured live provider record contains metadata only, not the dialing number.

## 3. Call Provider

```text
POST /api/agent-tools/call-provider
```

Request:

```json
{
  "missionId": "mission-...",
  "providerId": "provider-...",
  "objective": "Confirm availability, factual total cost and delivery timing for the mission."
}
```

Important semantics:

- the configured SABI communication adapter decides whether this is mock or live;
- live mode requires the Vapi/Kros configuration and explicit consented-provider mapping;
- `INITIATED` is initiation evidence only;
- the returned result is persisted to Mission Control;
- this action does not create a Quote.

Until the Kros number/runtime is ready, keep live communication disabled.

## 4. Record Provider Response

Preferred boundary for provider-call evidence:

```text
POST /api/agent-tools/record-provider-response
```

Request:

```json
{
  "missionId": "mission-...",
  "communicationId": "communication-...",
  "available": true,
  "price": 60000,
  "deliveryFee": 3000,
  "total": 63000,
  "deliveryDate": "tomorrow",
  "notes": "Structured factual fields extracted from the provider evidence."
}
```

Only `missionId`, `communicationId`, and `available` are always required. Optional facts should be omitted when unknown.

Rules enforced by SABI:

- Mission must be at a quote-collection/comparison stage;
- referenced communication must exist in the same Mission;
- communication must be `COMPLETED`;
- provider must exist in the Mission;
- a live Mission rejects `MOCK` communication evidence;
- Quote source/sourceReference are derived from the correlated communication;
- the same communication produces the same Quote ID, making retries idempotent;
- the structured facts are also attached to the communication observation;
- no recommendation is changed automatically.

This tool does not parse the transcript itself. The caller must supply only factual fields supported by the communication evidence.

## 5. Record Quote

```text
POST /api/agent-tools/record-quote
```

Request shape:

```json
{
  "quote": {
    "id": "quote-...",
    "missionId": "mission-...",
    "providerId": "provider-...",
    "available": true,
    "price": 60000,
    "deliveryFee": 3000,
    "total": 63000,
    "deliveryDate": "tomorrow",
    "notes": "Provider stated the represented terms.",
    "source": "CALL",
    "sourceReference": "communication-or-call-reference",
    "createdAt": "2026-10-01T21:00:00.000Z"
  }
}
```

Rules enforced by SABI:

- canonical Quote schema validation;
- Mission must be at an appropriate Quote stage;
- Quote must belong to an existing provider in that Mission snapshot;
- agent-recorded Quote requires `sourceReference` evidence;
- missing optional facts remain missing;
- recording a Quote does not automatically change the recommendation.

For provider communication, prefer `recordProviderResponse` because it binds the Quote directly to a completed communication.

## 6. Compare Quotes

```text
POST /api/agent-tools/compare-quotes
```

Request:

```json
{
  "missionId": "mission-..."
}
```

Behavior:

- Mission must be at `COMPARING`;
- validated Quotes must exist;
- loads persisted Mission, Providers, and Quotes;
- applies Femi's hard constraints;
- ranks only qualifying options;
- persists the resulting recommendation when one exists;
- returns exclusions/reasons through the intelligence result;
- performs no consequential action.

## 7. Orchestrate Mission

```text
POST /api/agent-tools/orchestrate-mission
```

Request:

```json
{
  "missionId": "mission-...",
  "mode": "SIMULATION"
}
```

Behavior:

- advances at most one canonical Mission stage per call;
- returns `ADVANCED`, `WAITING`, or `CHECKPOINT`;
- `SIMULATION` can only operate on a Mission created with `demoMode: true`;
- `LIVE` requires `SABI_COMMUNICATION_MODE=vapi-kros` before external communication;
- during live planning SABI may load only matching metadata from `SABI_LIVE_TEST_PROVIDERS_JSON`;
- live mode never borrows simulation providers, communication results, or Quotes;
- a waiting result is truthful and should not be overridden by the agent.

Typical sequence:

```text
CREATED
→ UNDERSTANDING
→ PLANNING
→ SEARCHING
→ CONTACTING
→ COLLECTING_QUOTES
→ COMPARING
→ AWAITING_APPROVAL
```

Bimpe may call this action again when the returned state indicates another safe stage can be advanced. Stop when the backend returns a waiting state or human checkpoint.

## 8. Request Approval

```text
POST /api/agent-tools/request-approval
```

Request:

```json
{
  "missionId": "mission-..."
}
```

Behavior:

- requires an existing recommendation;
- moves `COMPARING` to `AWAITING_APPROVAL` when appropriate;
- if already awaiting approval, returns the existing checkpoint;
- does not approve for the user;
- does not purchase, book, pay, transfer, or release funds.

## Recommended Bimpe action names

Register actions with these logical names so the agent prompt and backend terminology match:

```text
searchProviders
getProvider
callProvider
recordProviderResponse
recordQuote
compareQuotes
orchestrateMission
requestApproval
```

The source-of-truth manifest is:

```text
lib/integrations/bimpe/tool-manifest.ts
```

## Configuration order before the phone number arrives

These can be configured now:

1. Create/select the SABI Bimpe agent/workflow.
2. Add the runtime prompt from `BIMPE_SABI_AGENT_PROMPT.md`.
3. Upload/add the durable Knowledge from `BIMPE_KNOWLEDGE_BASE.md`.
4. Configure the shared bearer secret for SABI Custom API actions.
5. Register simulation-safe actions: `searchProviders`, `getProvider`, `recordProviderResponse`, `recordQuote`, `compareQuotes`, `orchestrateMission`, `requestApproval`.
6. Exercise one simulation mission and confirm tool responses remain labelled.
7. Configure `callProvider` as an action, but keep SABI live communication disabled until the Kros/Vapi runtime is ready.
8. Prepare the real consenting test-provider metadata for `SABI_LIVE_TEST_PROVIDERS_JSON` without including the phone number.

## Configuration after the Kros number arrives

Only after the live phone/SIP/runtime configuration is verified:

1. Configure the Kros number in the Vapi BYO/SIP path.
2. Add Vapi runtime secrets to the intended Preview environment.
3. Add real test-provider metadata to `SABI_LIVE_TEST_PROVIDERS_JSON`.
4. Add the same provider ID → explicitly consenting E.164 destination to `SABI_CONSENTED_PROVIDER_PHONES_JSON`.
5. Set `SABI_COMMUNICATION_MODE=vapi-kros` only on the intended test Preview.
6. Configure the Vapi webhook to SABI.
7. Test `callProvider` for the consented test provider.
8. Verify the phone rings and webhook returns into the same Mission.
9. Use the completed communication evidence to test `recordProviderResponse`.
10. Keep production disabled until the hackathon team explicitly decides otherwise.

## Required truth check before demo freeze

For each action, distinguish:

```text
HTTP request accepted
!= tool result correct
!= external action initiated
!= external action completed
!= provider fact verified
```

Only the evidence returned through SABI's canonical state should be presented as completed work.

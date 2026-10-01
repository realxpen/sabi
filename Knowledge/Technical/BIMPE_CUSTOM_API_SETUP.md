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
- `LIVE` returns `LIVE_PROVIDER_DIRECTORY_NOT_CONFIGURED` until a verified live provider directory is implemented.
- The backend never silently returns demo providers as live providers.

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

Current behavior follows the same simulation/live boundary as provider search.

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

- The configured SABI communication adapter decides whether this is mock or live.
- Live mode requires the Vapi/Kros configuration and explicit consented-provider mapping.
- `INITIATED` is initiation evidence only.
- The returned result is persisted to Mission Control.
- This action does not create a Quote.

Until the Kros number/runtime is ready, keep live communication disabled.

## 4. Record Quote

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
- Quote must belong to an existing provider in that Mission snapshot;
- agent-recorded Quote requires `sourceReference` evidence;
- missing optional facts remain missing;
- recording a Quote does not automatically change the recommendation.

## 5. Compare Quotes

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

- loads persisted Mission, Providers, and Quotes;
- applies Femi's hard constraints;
- ranks only qualifying options;
- persists the resulting recommendation when one exists;
- returns exclusions/reasons through the intelligence result;
- performs no consequential action.

## 6. Orchestrate Mission

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
- `LIVE` requires `SABI_COMMUNICATION_MODE=vapi-kros` and never borrows simulation data;
- a waiting result is truthful and should not be overridden by the agent.

Typical simulation sequence:

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

## 7. Request Approval

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
5. Register simulation-safe actions: `searchProviders`, `getProvider`, `recordQuote`, `compareQuotes`, `orchestrateMission`, `requestApproval`.
6. Exercise one simulation mission and confirm tool responses remain labelled.
7. Configure `callProvider` as an action, but keep SABI live communication disabled until the Kros/Vapi runtime is ready.

## Configuration after the Kros number arrives

Only after the live phone/SIP/runtime configuration is verified:

1. Configure the Kros number in the Vapi BYO/SIP path.
2. Add Vapi runtime secrets to the intended Preview environment.
3. Add the one explicitly consenting test destination to `SABI_CONSENTED_PROVIDER_PHONES_JSON`.
4. Set `SABI_COMMUNICATION_MODE=vapi-kros` only on the intended test Preview.
5. Configure the Vapi webhook to SABI.
6. Test `callProvider` for the consented test provider.
7. Verify the phone rings and webhook returns into the same Mission.
8. Keep production disabled until the hackathon team explicitly decides otherwise.

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

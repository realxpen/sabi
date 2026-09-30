# Codex Master Prompt — Lara Agent Tools & Communication Track

Status: ACTIVE PROMPT
Owner: Lara
Branch: `lara/agent-tools`
Last updated: 2026-09-30

Pull/rebase the latest `main` before starting.

---

You are working on SABI as the Agent Tools & Communication contributor.

Before editing code, read:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `Knowledge/Product/SABI_PRODUCT_SOURCE.md`
4. `Knowledge/Product/MVP_SCOPE.md`
5. `Knowledge/Product/TRUST_MODEL.md`
6. `Knowledge/Product/TEAM_BUILD_PHASES.md`
7. `Knowledge/Technical/ARCHITECTURE.md`
8. `Knowledge/Technical/MISSION_MODEL.md`
9. `Knowledge/Technical/INTEGRATION_CONTRACTS.md`
10. `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
11. `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
12. `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
13. `Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md`
14. `Knowledge/UX/DEMO_FLOW.md`
15. `Knowledge/Decisions/ACTIVE_DECISIONS.md`
16. `Raw/PartnerDocs/SOURCE_LINKS.md`

Then inspect shared schemas, Mission state machine, adapter contracts, current mocks and tests.

Do not redefine Mission, Provider, Quote, MissionStep, Approval, CommunicationResult, Mission states, or shared adapter contracts without identifying the conflict and stopping for team review.

## Responsibility

Make SABI capable of taking bounded external communication actions and reliably converting partner outcomes into validated internal state.

You own:

- communication/tool implementations
- provider-neutral adapter behavior
- call/message lifecycle
- event/webhook normalization
- idempotency/recovery
- KrosAI telephony integration
- selected voice runtime
- optional multilingual enhancement after base loop
- optional Temlio fallback only after its contract is known

You do not own:

- recommendation/ranking logic
- UI architecture
- product-scope changes
- real payment/escrow

## Source-priority rule

For partner code:

1. current official API/reference docs
2. live API Explorer/dashboard/account behavior
3. ACTIVE SABI integration knowledge
4. older examples only as historical context

If official docs conflict, do not guess. Centralize the uncertainty and verify with a minimal safe request/test.

## L1 — Tool layer

Implement/maintain bounded tools using shared schemas:

- `searchProviders`
- `getProvider`
- `callProvider`
- `sendMessage`
- `recordQuote`
- `requestApproval`

Rules:

- validate input
- structured output only
- no unrestricted database access
- `callProvider` initiation does not pretend a call completed
- `requestApproval` never performs payment/purchase

## L2 — Communication adapter

Use the existing provider-neutral adapter boundary.

Support normalized states equivalent to:

- initiated
- in progress
- completed
- no answer
- unavailable
- failed

Keep deterministic mocks until the real path is proven.

## L3 — Event normalization

```text
partner payload
→ auth/signature verification
→ schema validation
→ correlation resolution
→ CommunicationResult
→ controlled Mission transition
```

Raw partner payloads must never mutate Mission directly.

Preserve external IDs/source references.

## L4 — Kros webhook boundary

Implement:

- raw request body preservation
- `X-Webhook-Signature` verification according to the confirmed live Kros contract
- provider event-ID deduplication
- mission/provider/communication correlation
- quick valid 2xx response
- centralized Kros event alias/version mapping
- idempotent downstream transcript/Quote processing
- logs without secrets

Important: current official Kros pages contain multiple webhook naming conventions. Confirm the live dashboard/API Explorer event schema and keep all partner-name differences inside the Kros adapter.

## L5 — Failure/recovery

Test:

- no answer
- busy
- delayed response
- malformed event
- duplicate event
- unknown external call ID
- network/provider failure
- provider unavailable
- incomplete transcript/result

Rules:

- one provider failure does not automatically fail the whole Mission
- failed/no-answer calls create no fake Quote
- transcript is evidence, not automatically Quote data
- unknown values stay unknown
- fallback is attempted only when implemented/authorized

## L6 — KrosAI transport

Do this before full voice-runtime complexity.

1. Confirm account/KYC/API key/phone number.
2. Confirm actual live REST base/path using API Explorer or a minimal request; official docs currently show `/v1` vs `/api/v1` and outbound singular/plural inconsistencies.
3. Store route/base through configuration, not scattered hard-coded URLs.
4. Create one endpoint.
5. Attach endpoint to Kros number.
6. Place one consented test call.
7. Capture external call ID/lifecycle.
8. Receive/verify one signed webhook/event.
9. Correlate `missionId`, `providerId`, `communicationId` through metadata/records.
10. Retrieve transcript/result.
11. Normalize to `CommunicationResult`.
12. Create Quote only when factual required fields exist.

### L6 gate

One consented real call uses the same SABI adapter boundary as mocks and becomes truthful internal state without rewriting Mission.

## L7 — Voice runtime

### Primary: Vapi

Test the documented Kros SIP/BYO-number path first.

Expected access/artifacts:

- Vapi API key
- Vapi Assistant ID
- Vapi SIP Trunk Credential ID
- Kros endpoint ID
- Kros number SIP credentials

Keep Vapi only if repeat calls are reliable.

### Fallback order

If Vapi cannot be made reliable quickly:

1. Retell
2. ElevenLabs

Do not integrate all simultaneously.

## L8 — African-language enhancement

Only after L6/L7 are stable.

Preferred advanced path:

```text
KrosAI → LiveKit SIP → LiveKit Agent → Spitch STT/TTS → SABI/Bimpe tools
```

Add one useful language first, for example Nigerian Pidgin or Yoruba.

YarnGPT may be used for optional TTS/translation/streaming synthesis/post-call STT. Its documented ASR is asynchronous/polled, so do not make it the first critical live-ASR path.

## L9 — Temlio fallback

Temlio's public site verifies Voice/SMS/USSD/local-number REST capabilities but detailed auth/request/webhook contracts remain unavailable publicly.

Do not invent a payload.

If partner docs/access arrive, preferred first use is:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ provider reply/event
→ CommunicationResult
```

## Bimpe coordination boundary

BimpeAI is primarily the workflow/Knowledge/bounded-tool layer. Your communication tools may be exposed to Bimpe through SABI Custom API endpoints, but Bimpe must not bypass Mission/CommunicationResult contracts.

Current Bimpe TypeScript SDK docs target Node 24+ while SABI CI is Node 20. The active plan is REST/native server-side `fetch` first unless the team deliberately upgrades and retests the runtime.

No native BimpeAI↔KrosAI bridge is assumed; SABI-owned tools/APIs connect them.

## Observability

Ensure we can inspect:

- missionId
- providerId
- communicationId
- partner external call/event ID
- normalized status
- timestamps
- failure category
- source channel
- transcript/result reference
- Quote/source relationship

Never log credentials/auth headers unnecessarily.

## Coding rules

- work only on `lara/agent-tools`
- pull/rebase latest `main` first
- do not alter Femi ranking/retrieval logic
- do not alter UI except minimal integration glue when explicitly needed
- no real payment/escrow
- never invent partner endpoints/payloads
- keep partner code behind adapters
- explicit input → validation → transformation → state functions
- idempotent event handling
- focused success/failure tests
- no secrets in commits
- live calls only to consenting test participants/providers

## Before completion

Run relevant lint/typecheck/tests/build.

Report:

1. files changed
2. L1–L9 stages completed
3. mock scenarios verified
4. confirmed live Kros REST route/event convention
5. Kros real-call status
6. selected voice-runtime status
7. webhook/recovery tests
8. assumptions
9. credentials/access still needed
10. shared-contract questions
11. branch/commit hash

Stop when the track is integration-ready. Do not merge to `main` unless the team workflow explicitly allows it.

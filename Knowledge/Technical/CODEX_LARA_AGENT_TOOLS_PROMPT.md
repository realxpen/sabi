# Codex Master Prompt — Lara Agent Tools & Communication Track

Status: ACTIVE PROMPT
Owner: Lara
Branch: lara/agent-tools

Use this prompt only after the shared Phase 1 foundation has been merged and the canonical schemas compile.

---

You are working on SABI as the Agent Tools & Communication contributor.

Before editing code, read these files in this order:

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

Then inspect the current shared schemas, mission state machine, adapter contracts, and tests.

Do not redefine Mission, Provider, Quote, MissionStep, Approval, CommunicationResult, mission states, or shared adapter contracts without first identifying the conflict and stopping for team review.

## Your responsibility

Your job is to make SABI capable of taking bounded external actions and reliably converting the outcome into validated system state.

You own:

- agent tool implementations/interfaces
- communication adapter behavior
- call/message lifecycle
- external event handling
- webhook normalization
- retries/recovery
- KrosAI telephony integration
- selected voice-runtime integration
- optional African-language/speech integration after the base loop works
- optional Temlio fallback only after its API contract is provided

You do not own:

- provider ranking logic
- recommendation weights
- UI architecture
- product-scope changes
- real financial transactions

## L1 — Tool layer

Implement or complete narrow tools using the existing shared contracts:

- `searchProviders`
- `getProvider`
- `callProvider`
- `sendMessage`
- `recordQuote`
- `requestApproval`

Rules:

- validate tool input
- return structured result objects
- do not expose unrestricted database access
- do not let `callProvider` pretend a call completed synchronously
- do not let `requestApproval` perform a purchase

### L1 gate

Every tool has a clear validated input/output contract and can be invoked without knowing a specific partner payload.

## L2 — Communication adapter

Use the existing provider-neutral communication adapter boundary.

Support lifecycle states equivalent to:

- initiated
- in progress
- completed
- no answer
- unavailable
- failed

Keep a deterministic mock adapter until the real path is proven.

### L2 gate

The application can contact a provider through the adapter without importing KrosAI/Vapi/etc. throughout the Mission domain.

## L3 — Event → observation normalization

Implement:

```text
external event/result
→ schema validation
→ signature/auth verification where available
→ mission/provider/correlation resolution
→ CommunicationResult
→ quote candidate / structured observation
→ controlled state transition
```

Raw external payloads must not mutate Mission state directly.

Preserve partner external IDs/source references.

### L3 gate

A completed mock communication can become a validated internal observation consumed by the mission engine.

## L4 — Webhook architecture

Build the KrosAI webhook boundary before the full provider-call loop.

Required behavior:

- preserve the raw request body for signature verification
- verify `X-Webhook-Signature` according to the current KrosAI contract/live setup
- validate payload shape
- deduplicate by provider event ID
- resolve mission/provider/communication correlation
- respond 2xx quickly
- keep heavier transcript/quote processing outside the raw handler when practical
- log failures without secrets
- keep Kros-specific event mapping in the adapter

Important: KrosAI public docs currently contain old and new webhook event names. Use the current API Explorer/dashboard schema and keep event-name mapping centralized.

### L4 gate

Webhook test fixtures prove malformed, duplicate, unknown-correlation, and valid events are handled safely.

## L5 — Failure and recovery

Implement/test:

- no answer
- busy
- delayed response
- provider unavailable
- malformed event
- duplicate event
- unknown external call ID
- network/provider failure
- incomplete transcript/result

Rules:

- one provider failure does not automatically fail the whole Mission
- no failed/no-answer call produces a fabricated Quote
- a transcript is evidence, not automatically a Quote
- fallback channel is attempted only when actually implemented and authorized
- Mission escalates/fails honestly when it cannot continue

### L5 gate

Failure paths preserve truthful Mission state and never manufacture provider facts.

## L6 — Real partner integration: KrosAI first

Do not start by connecting every partner.

Follow `PARTNER_INTEGRATIONS.md`, `INTEGRATION_STACK_DECISION.md`, and `INTEGRATION_ACCESS_CHECKLIST.md`.

### L6A — prove Kros transport

1. Confirm KrosAI account/KYC/API key/phone number.
2. Confirm the live Kros REST base/path in API Explorer; docs currently contain `/v1` vs `/api/v1` inconsistencies.
3. Configure one endpoint.
4. Attach endpoint to Kros number.
5. Place one consented test call.
6. Capture call ID and lifecycle.
7. Receive a signed webhook/test event.
8. Correlate `missionId`, `providerId`, `communicationId` through metadata.
9. Retrieve/use the transcript/result.
10. Normalize to `CommunicationResult` and Quote only when factual fields exist.

### L6B — primary voice-runtime candidate: Vapi

Test the documented KrosAI ↔ Vapi SIP/BYO-number path first.

Required artifacts include:

- Vapi Assistant ID
- Vapi SIP Trunk Credential ID
- KrosAI endpoint ID

Only keep Vapi as primary if repeat calls are reliable.

### L6C — fallback runtime

If Vapi is not reliable quickly, test one alternative:

- Retell first
- ElevenLabs second

Do not integrate multiple fallbacks simultaneously.

### L6 gate

A real consented phone call can be triggered through the same SABI adapter contract as the mock path, and its result becomes truthful internal state without rewriting Mission.

## L7 — African-language / speech enhancement

Only begin after L6 is reliable.

Preferred advanced path:

```text
KrosAI → LiveKit SIP → LiveKit agent → Spitch STT/TTS → SABI tools
```

Spitch has an official LiveKit plugin and KrosAI has a documented LiveKit endpoint integration.

Add only one useful language demonstration first.

YarnGPT may be used as an optional TTS/translation/post-call STT enhancement, but its documented ASR is asynchronous, so do not make it the first critical real-time phone ASR path.

### L7 gate

Language capability works without destabilizing the primary phone loop.

## L8 — Temlio fallback + observability

Temlio's public site confirms Voice/SMS/USSD REST capabilities but does not currently provide enough public request/auth/webhook detail for safe implementation.

Do not invent a Temlio adapter payload.

If event docs/credentials arrive, SMS fallback is the preferred first Temlio use:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ response/event
→ CommunicationResult
```

Ensure observability includes:

- missionId
- providerId
- communicationId
- partner external ID
- current status
- timestamps
- failure category
- source channel
- quote/source relationship

Do not log credentials/auth headers or unnecessary sensitive content.

## BimpeAI coordination boundary

BimpeAI belongs primarily to agent workflow/knowledge/tool orchestration. Lara may expose/maintain communication tools that Bimpe calls, but should not let Bimpe bypass the SABI Mission/CommunicationResult contracts.

Important runtime note: BimpeAI's TypeScript SDK currently documents Node 24+, while SABI CI is Node 20. The active integration plan is to use Bimpe REST/native `fetch` first unless the team deliberately upgrades and verifies the runtime.

There is no verified public native BimpeAI ↔ KrosAI bridge; SABI-owned APIs/tools are the boundary.

## Coding rules

- Work only on `lara/agent-tools`.
- Pull/rebase latest `main` before beginning.
- Do not alter Femi's ranking/retrieval logic.
- Do not alter UI except minimal integration glue if explicitly required.
- Do not implement real payment or escrow.
- Never invent partner endpoints/payloads.
- Keep partner code behind adapters.
- Prefer explicit input → validation → transformation → state functions.
- Keep webhook/event processing idempotent.
- Add focused success/failure tests.
- Never commit secrets.

## Before completion

Run the relevant lint/typecheck/tests/build.

Report:

1. files changed
2. L1–L8 stages completed
3. mock communication scenarios verified
4. KrosAI test status
5. selected voice-runtime status
6. webhook/recovery tests
7. assumptions
8. credentials/access still needed
9. shared-contract questions
10. branch/commit hash

Stop when the track is integration-ready. Do not merge to `main` unless the team workflow explicitly allows it.

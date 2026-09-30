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

You own communication/tools, adapter behavior, call/message lifecycle, webhook/event normalization, idempotency/recovery, KrosAI telephony, selected voice runtime, optional multilingual enhancement, and optional Temlio fallback after its contract is known.

You do not own recommendation/ranking logic, UI architecture, product-scope changes, or real payment/escrow.

## Source priority

For partner code:

1. current official API/reference docs
2. live API Explorer/dashboard/account behavior
3. ACTIVE SABI integration knowledge
4. older examples only as historical context

If official docs conflict, do not guess. Centralize uncertainty and verify with a minimal safe request/test.

## L1 — Tool layer

Maintain bounded tools:

- `searchProviders`
- `getProvider`
- `callProvider`
- `sendMessage`
- `recordQuote`
- `requestApproval`

Validate inputs/outputs. `callProvider` initiation does not mean completion. `requestApproval` never performs payment/purchase.

## L2 — Communication adapter

Use the existing provider-neutral adapter. Keep deterministic mocks until the real path is proven.

Normalize states equivalent to initiated, in-progress, completed, no-answer, unavailable and failed.

## L3 — Event normalization

```text
partner payload
→ auth/signature verification
→ schema validation
→ correlation resolution
→ CommunicationResult
→ controlled Mission transition
```

Raw partner payloads never mutate Mission directly.

## L4 — Kros webhook boundary

Implement:

- raw body preservation
- `X-Webhook-Signature` verification using the confirmed live contract
- provider event-ID deduplication
- mission/provider/communication correlation
- quick valid 2xx response
- centralized event alias/version mapping
- idempotent transcript/Quote processing
- secret-safe logs

Current official Kros pages contain multiple webhook naming conventions. Confirm the live dashboard/API Explorer schema and keep all differences inside the adapter.

## L5 — Failure/recovery

Test no-answer, busy, delay, malformed/duplicate event, unknown external call ID, network/provider failure, unavailable provider and incomplete transcript/result.

Rules:

- provider failure does not automatically fail the whole Mission
- failed/no-answer calls create no fake Quote
- transcript is evidence, not automatically Quote data
- unknown values stay unknown
- fallback only when implemented/authorized

## L6 — KrosAI transport

1. Confirm account/KYC/key/number.
2. Confirm actual live REST base/path through API Explorer/minimal request; official docs currently show `/v1` vs `/api/v1` and outbound singular/plural inconsistencies.
3. Store base/route through centralized configuration.
4. Create one endpoint.
5. Attach endpoint to Kros number.
6. Place one consented test call.
7. Capture external call ID/lifecycle.
8. Receive/verify one signed webhook/event.
9. Correlate `missionId`, `providerId`, `communicationId`.
10. Retrieve transcript/result.
11. Normalize to `CommunicationResult`.
12. Create Quote only when factual required fields exist.

L6 gate: one consented real call uses the same adapter boundary as mocks without rewriting Mission.

## L7 — Voice runtime

### Primary: Vapi

Test documented Kros SIP/BYO path first.

Expected access:

- Vapi API key
- Assistant ID
- SIP Trunk Credential ID
- Kros endpoint ID
- Kros number SIP credentials

Keep Vapi only if repeat calls are reliable.

### Fallback order

1. Retell
2. ElevenLabs

Do not integrate all simultaneously.

## L8 — African-language enhancement

Only after L6/L7 are stable.

Preferred advanced path:

```text
KrosAI → LiveKit SIP → LiveKit Agent → Spitch STT/TTS → SABI/Bimpe tools
```

Add one language first, e.g. Nigerian Pidgin or Yoruba.

YarnGPT is optional for TTS/translation/streaming synthesis/post-call STT; its documented ASR is asynchronous/polled, so it is not the first critical live-ASR path.

## L9 — Temlio fallback

Do not invent payloads. If detailed partner docs/access arrive, preferred first use is:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ provider reply/event
→ CommunicationResult
```

## Bimpe boundary

BimpeAI is the workflow/Knowledge/bounded-tool layer. Communication tools may be exposed through SABI Custom API endpoints, but Bimpe must not bypass Mission/CommunicationResult contracts.

Current Bimpe TS SDK docs target Node 24+ while SABI CI is Node 20, so the active plan is REST/native server-side `fetch` unless the team deliberately upgrades and retests runtime.

No native BimpeAI↔KrosAI bridge is assumed; SABI-owned APIs/tools connect them.

## Observability

Track:

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
- pull/rebase latest `main`
- do not alter Femi ranking/retrieval logic
- minimal UI changes only if explicitly required
- no real payment/escrow
- never invent partner endpoints/payloads
- keep partner code behind adapters
- explicit input → validation → transformation → state
- idempotent event handling
- focused success/failure tests
- no secrets in commits
- live calls only to consenting test participants/providers

## Before completion

Run relevant lint/typecheck/tests/build and report:

1. files changed
2. L1–L9 completed
3. mock scenarios verified
4. confirmed live Kros REST route/event convention
5. Kros real-call status
6. selected voice-runtime status
7. webhook/recovery tests
8. assumptions
9. credentials/access still needed
10. shared-contract questions
11. branch/commit hash

Stop when integration-ready. Do not merge to `main` unless the team workflow explicitly allows it.

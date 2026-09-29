# Codex Master Prompt — Lara Agent Tools & Communication Track

Status: ACTIVE PROMPT
Owner: Lara
Branch: lara/agent-tools

Use this prompt only after the shared Phase 1 foundation has been merged and the canonical schemas compile.

---

You are working on SABI as the Agent Tools & Communication contributor.

Before editing code, read these files in this order:

1. AGENTS.md
2. PROJECT_STATE.md
3. Knowledge/Product/SABI_PRODUCT_SOURCE.md
4. Knowledge/Product/MVP_SCOPE.md
5. Knowledge/Product/TRUST_MODEL.md
6. Knowledge/Product/TEAM_BUILD_PHASES.md
7. Knowledge/Technical/ARCHITECTURE.md
8. Knowledge/Technical/MISSION_MODEL.md
9. Knowledge/Technical/INTEGRATION_CONTRACTS.md
10. Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md
11. Knowledge/UX/DEMO_FLOW.md
12. Knowledge/Decisions/ACTIVE_DECISIONS.md

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
- partner integration behind adapters
- African-language/speech integration after the base loop works

You do not own:

- provider ranking logic
- recommendation weights
- UI architecture
- product-scope changes
- real financial transactions

## L1 — Tool layer

Implement or complete narrow tools using the existing shared contracts.

Target tool concepts:

- searchProviders
- getProvider
- callProvider
- sendMessage
- recordQuote
- requestApproval

Rules:

- validate tool input
- return structured result objects
- do not expose unrestricted database access
- do not let callProvider pretend a call has completed synchronously
- do not let requestApproval perform a purchase

Keep tools small and composable.

### L1 gate

Every tool has a clear validated input/output contract and can be invoked without knowing a specific partner's API payload.

## L2 — Communication adapter

Implement a provider-neutral communication adapter interface if not already present.

It should support a lifecycle such as:

- initiated
- in_progress if useful
- completed
- no_answer
- unavailable
- failed

Create or retain a mock adapter that supports deterministic demo/test scenarios.

Mock scenarios should include:

- successful provider response
- no answer
- provider unavailable
- incomplete response
- integration failure

Do not fake completion with UI timers.

### L2 gate

The main application can contact a provider through the adapter without importing partner-specific code.

## L3 — Event → observation normalization

Create the flow:

external event/result
→ validation
→ authenticated/verified event when possible
→ mission/provider resolution
→ normalized CommunicationResult
→ quote candidate/structured observation
→ state transition

Do not let raw external payloads mutate Mission state directly.

Keep original external IDs/source references for traceability.

### L3 gate

A completed mock communication can be transformed into a validated internal observation and consumed by the mission engine.

## L4 — Webhook architecture

Prepare webhook handlers for external communication providers.

Important behavior:

- reject malformed inputs
- verify provider signatures when documentation supports it
- resolve externalCallId/messageId to mission/provider
- make duplicate processing safe/idempotent where feasible
- log errors without secrets
- return appropriate HTTP responses
- keep partner-specific parsing behind the adapter layer

Do not invent real partner signature schemes or payload fields.

If official docs/access are unavailable, create a clearly marked placeholder interface/test fixture, not fictional production code.

### L4 gate

Mock webhook fixtures prove the handler architecture and duplicate/malformed events are safe.

## L5 — Failure and recovery behavior

Implement/test:

- no answer
- delayed response
- provider unavailable
- malformed external event
- duplicate external event
- unknown externalCallId
- partner/network failure
- partial/incomplete response

Expected product behavior:

- one provider failure should not automatically fail the entire mission
- failure is recorded truthfully
- fallback channel can be attempted only if implemented/allowed
- mission continues when enough viable candidates remain
- mission escalates/fails honestly when it cannot proceed

### L5 gate

Failures do not produce fake quotes and the mission remains recoverable where appropriate.

## L6 — Real partner integration

Only start this after the mock communication loop works.

Use verified official docs/access for the selected provider.

Likely categories based on current project knowledge:

- KrosAI for telephony
- Temlio for voice/SMS/USSD communication
- YarnGPT for African-language voice
- Spitch for STT/TTS
- BimpeAI for agent orchestration/tools/workflows

Do not assume all must be used.

Choose the minimum combination that makes the real demo reliable.

Keep each partner behind an adapter.

Never place secrets in client code or commit them.

Document required environment variable names without values.

### L6 gate

At least one verified real communication path can be triggered through the same adapter contract used by the mock path, without rewriting the Mission domain.

## L7 — African-language / speech layer

Only begin after L6 base communication works reliably.

If the verified APIs allow it, add one clear multilingual capability useful to the demo.

Examples:

- English ↔ Naija Pidgin
- Yoruba speech interaction

Do not add multiple languages just for breadth.

Favor one reliable, demonstrable flow.

### L7 gate

Language/speech capability does not break the core provider-contact loop.

## L8 — Tool/communication observability

Ensure we can inspect:

- missionId
- providerId
- internal communication record ID
- partner external ID
- current status
- timestamps
- failure category
- source channel
- quote/source relationship

Do not log credentials, auth headers, or sensitive raw data unnecessarily.

## Coding rules

- Work only on your branch: lara/agent-tools.
- Pull/rebase from latest main before beginning.
- Do not alter Femi's ranking/retrieval logic.
- Do not alter UI except minimal integration glue if explicitly required.
- Do not implement real payment or escrow.
- Do not invent partner APIs.
- Use adapter boundaries.
- Prefer explicit input → validation → transformation → new-state functions.
- Keep webhook/event handlers idempotent where practical.
- Add focused tests for failure behavior.

## Before completion

Run the relevant:

- lint
- typecheck
- tests
- build if your changes affect build output

Then report:

1. files changed
2. L1–L8 stages completed
3. mock communication scenarios verified
4. real partner integration status
5. webhook/recovery tests run
6. assumptions made
7. blockers/credential needs
8. whether any shared contract needs team review
9. branch/commit hash

Stop when your track is integration-ready. Do not merge into main yourself unless the team workflow explicitly allows it.

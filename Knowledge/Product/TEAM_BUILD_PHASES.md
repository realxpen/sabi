# Three-Person Vibe-Coding Build Phases

Status: ACTIVE PLAN
Last updated: 2026-09-30
Team: Xpen, Femi, Lara

## Current state

The shared contracts, mock mission engine, Mission Control, integration research, and partner-stack decisions are already on `main`.

All three workstreams now run in parallel from the current main checkpoint.

## Branches

- `xpen/mvp-shell`
- `femi/intelligence`
- `lara/agent-tools`

Always pull/rebase latest `main` before coding.

## Shared rule

No teammate or coding agent may silently change:

- Mission
- Provider
- Quote
- CommunicationResult
- Mission states
- Approval semantics
- shared tool/adapter contracts

If one must change, stop, explain why, agree as a team, update ACTIVE knowledge/decisions, then implement.

# Xpen — Product & Integration

## X1 — Integration shell (current)

Own:

- Mission Control
- route/API glue
- integration visibility
- human-approval UX
- overall state coherence
- temporary fixture removal as teammate modules land

## X2 — First integrated mock loop

Integrate Femi + Lara modules into:

```text
request
→ validated Mission
→ provider discovery
→ communication action
→ structured observation/Quote
→ filtering/ranking
→ recommendation
→ human approval
```

Do not move to live partner calls until this loop is stable.

## X3 — BimpeAI orchestration integration

Coordinate the Bimpe layer with the backend:

- create/select workflow + agent
- add curated Knowledge Base entries
- configure SABI Custom API integration
- register only bounded SABI tools
- preserve SABI as system of record
- use REST/native server `fetch` first under Node 20

Xpen gate: Bimpe can reason with relevant knowledge and invoke at least one safe SABI tool without bypassing Mission/Approval contracts.

## X4 — Final integration/demo hardening

Own the final golden path, visual truthfulness, demo choreography, and freeze decision.

# Femi — Intelligence, Data & Knowledge

Branch: `femi/intelligence`

Use `Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`.

## F1 — Demo/provider data

Create/test fictional provider data and quote scenarios against shared schemas.

## F2 — Hard constraints

Filter by item/service match, availability, quantity, deadline, hard budget, and any explicit user constraint.

Return structured exclusion reasons.

## F3 — Soft ranking

Rank only qualifying candidates with transparent factors such as price, verification, reliability, location and rating.

Return explanation-ready reasons, not only scores.

## F4 — Quote intelligence

Normalize factual provider observations to Quote. Unknown values remain unknown.

Transcript/tool output is evidence, not automatically a valid Quote.

## F5 — Knowledge/retrieval

Implement the SABI runtime retrieval seam:

- curated knowledge chunks
- source IDs
- relevant retrieval
- context assembler

Separate durable knowledge from operational facts.

## F6 — Bimpe Knowledge mapping

Prepare curated content that belongs in the Bimpe Knowledge Base:

- trust policy
- approval policy
- procurement rules
- provider communication rules
- category guidance

Do not put today's price/availability/call outcome into Bimpe KB.

## F7 — Evaluation

Required cases:

- happy path
- deadline conflict
- over-budget options
- missing data
- no-answer
- all providers invalid
- irrelevant knowledge retrieval
- transcript missing required quote fields
- deterministic recommendation

Femi gate: Mission + validated Quotes + relevant Knowledge returns correct qualifying options, explanation factors, and no invented data.

# Lara — Agent Tools & Communication

Branch: `lara/agent-tools`

Use:

- `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
- `Raw/PartnerDocs/SOURCE_LINKS.md`

## L1 — Tool layer

Implement/maintain bounded tools:

- searchProviders
- getProvider
- callProvider
- sendMessage
- recordQuote
- requestApproval

## L2 — Communication adapter

Keep provider-neutral lifecycle and deterministic mocks.

## L3 — Event normalization

```text
partner payload
→ validation/auth
→ correlation resolution
→ CommunicationResult
→ controlled Mission transition
```

## L4 — Kros webhook boundary

Implement raw-body signature verification, event-ID idempotency, correlation, centralized event mapping, and truthful status transitions.

Kros official docs currently contain multiple event-name/path variants; do not guess outside the adapter.

## L5 — Failure/recovery

Handle:

- no answer
- busy
- delayed response
- malformed event
- duplicate event
- unknown external ID
- provider/network failure
- incomplete transcript/result

No failed call may create a fabricated Quote.

## L6 — Real KrosAI transport

Order:

1. account/KYC/key/number
2. confirm live REST route in API Explorer/minimal request
3. create/attach one endpoint
4. one consented test call
5. capture external call ID/lifecycle
6. receive/verify webhook
7. correlate mission/provider/communication
8. obtain transcript/result
9. normalize to CommunicationResult

L6 gate: one real consented call flows through the same adapter contract used by mocks.

## L7 — Voice runtime

Try Vapi first using the documented Kros SIP/BYO path.

If Vapi is not reliable quickly:

1. Retell
2. ElevenLabs

Use one runtime in the golden path.

## L8 — Multilingual enhancement

Only after L6/L7 are stable.

Preferred advanced path:

```text
KrosAI → LiveKit → Spitch STT/TTS → SABI/Bimpe tools
```

Add one useful language first, not many.

YarnGPT remains optional for TTS/translation/streaming synthesis/post-call STT.

## L9 — Temlio fallback

Only if detailed partner docs/access arrive.

Preferred first use:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ provider response/event
→ CommunicationResult
```

Do not invent Temlio API contracts.

# Integration order

The team merges/integrates in this order:

1. stable shared contracts/main
2. Femi intelligence/data/retrieval
3. Lara tools/communication mocks
4. Xpen integrated mock loop
5. Bimpe workflow/KB/bounded tools
6. Kros real transport
7. Vapi or one fallback runtime
8. optional Spitch/LiveKit multilingual enhancement
9. optional Temlio SMS fallback
10. demo hardening/freeze

Do not put optional partner work ahead of the golden path.

# Golden-path freeze gate

Freeze primary features once this is repeatable:

```text
Mission created
→ candidate provider selected
→ real consented phone receives call
→ provider response/transcript captured
→ Quote validated
→ qualifying options compared
→ Mission Control updated
→ human approval requested
```

After this, optional integrations may not destabilize the demo.

# Failure ownership

- UI/Mission state visibility wrong → Xpen
- matching/recommendation/retrieval wrong → Femi
- call/message/webhook/action wrong → Lara
- shared-contract conflict → all three stop and resolve together

# Vibe-coding session rule

Every teammate begins with:

> Read AGENTS.md, PROJECT_STATE.md, relevant ACTIVE Knowledge, shared schemas, and verified partner docs before editing. Do not change shared contracts or architecture without explaining the conflict first. Work only on the assigned phase and run relevant tests before reporting completion.

# Handoff rule

Each teammate reports:

- completed phase/gate
- files changed
- tests/typecheck/build run
- real vs mock behavior
- assumptions
- credentials/access still needed
- blockers
- shared-contract questions
- exact branch/commit

Do not hand off with only “it should work.”

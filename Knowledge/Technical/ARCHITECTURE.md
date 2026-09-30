# SABI System Architecture

Status: ACTIVE
Last verified: 2026-09-30

## Architecture objective

Support one reliable end-to-end agentic commerce/coordination workflow without overbuilding or collapsing partner services into one undifferentiated stack.

## Current hackathon architecture

```text
USER
  ↓
SABI Web App / Mission Control
  ↓
SABI Mission API + State Machine
  ↓
Context Assembler
  ├─ current Mission
  ├─ relevant Knowledge/Retrieval
  ├─ provider data
  ├─ relevant memory/preferences
  ├─ latest tool observations
  └─ approval/permission state
  ↓
BimpeAI Agent / Workflow
  ├─ system instructions
  ├─ curated Knowledge Base
  └─ bounded SABI API tools
  ↓
SABI Tool Layer
  ├─ searchProviders
  ├─ getProvider
  ├─ callProvider
  ├─ sendMessage
  ├─ recordQuote
  ├─ compareQuotes
  └─ requestApproval
  ↓
SABI Communication Adapter
  ↓
KrosAI — primary telephony transport
  ↓
Vapi — first voice-runtime candidate
  ↓
REAL PROVIDER PHONE
  ↓
KrosAI webhook / call log / transcript
  ↓
CommunicationResult
  ↓
Validated Quote
  ↓
Femi intelligence layer
  ├─ hard constraints
  ├─ ranking
  └─ recommendation factors
  ↓
Xpen Mission Control
  ↓
HUMAN APPROVAL
  ↓
STOP
```

The MVP stops before real payment, booking commitment, escrow release, or other consequential transaction.

## System-of-record boundary

SABI remains authoritative for:

- Mission
- Provider
- MissionStep
- CommunicationResult
- Quote
- recommendation inputs/results
- Approval
- guardrails
- external correlation IDs

External services may reason, transport calls, synthesize/transcribe speech, or invoke tools; they must not silently redefine these domain objects.

## BimpeAI role

BimpeAI is the agent/workflow/knowledge/tool-orchestration layer.

Verified capabilities include:

- agents bound to workflows
- text/URL Knowledge Bases
- custom API integrations and callable HTTP tools
- conversations and streaming
- API-key authentication

For the hackathon, use the Bimpe REST API through native server-side `fetch` first. The current Bimpe TypeScript SDK documents Node 24+ while SABI CI currently runs Node 20, so do not introduce the SDK without an intentional runtime upgrade and full CI verification.

BimpeAI must call bounded SABI APIs rather than receiving unrestricted database access.

## KrosAI role

KrosAI is the primary phone transport.

Verified responsibilities:

- local phone numbers
- inbound/outbound call transport
- endpoint routing
- Vapi/Retell/ElevenLabs/LiveKit/custom endpoint support
- call lifecycle/logs
- recordings/transcripts
- signed webhooks

Use Kros metadata/correlation fields for `missionId`, `providerId`, and `communicationId` where the live API accepts them.

Important: official Kros docs currently show inconsistent REST examples (`/v1` vs `/api/v1`, and singular/plural outbound paths). Keep route construction centralized and configurable through `KROSAI_BASE_URL`, and confirm the live route through API Explorer/dashboard before demo freeze.

## Voice-runtime decision

Primary candidate:

```text
KrosAI → Vapi → provider phone
```

Vapi is first because Kros documents a concrete SIP/BYO-number path and positions it for structured workflows/tool calling.

Fallback order if Vapi is not reliable quickly:

1. Retell
2. ElevenLabs

Do not make multiple voice runtimes simultaneous critical-path dependencies.

## Advanced multilingual path

Only after the English/base call loop is stable:

```text
KrosAI number
→ LiveKit SIP
→ LiveKit Agent
→ Spitch STT/TTS
→ SABI/Bimpe tools
```

Spitch documents STT, TTS, translation, Nigerian Pidgin and an official LiveKit agent integration. This is an enhancement, not a prerequisite for the golden path.

YarnGPT is optional for African TTS, translated synthesis, low-latency single-turn audio, or post-call STT. Its documented ASR is asynchronous/polled, so it should not be the first critical real-time ASR dependency.

## Temlio role

Temlio is reserved for fallback communications, especially SMS after `no_answer`, `busy`, or failed calls.

Its public site confirms Voice/SMS/USSD/local-number/REST capabilities, but detailed request/auth/webhook contracts are still not public enough to implement safely. Keep the adapter boundary only until partner/event documentation or live account details are available.

## External communication flow

Calls/messages are asynchronous.

```text
Agent/tool decision
→ callProvider()
→ communication adapter validates input
→ KrosAI accepts call and returns external ID/status
→ Mission remains CONTACTING/COLLECTING
→ real call occurs
→ signed webhook / transcript-ready event arrives
→ verify raw payload signature
→ deduplicate provider event ID
→ resolve mission/provider/communication correlation
→ normalize to CommunicationResult
→ extract only factual quote fields
→ validate Quote
→ advance Mission
→ compare/recommend
→ request human approval
```

`initiated` is not `completed`. A transcript is evidence, not automatically a valid Quote.

## Webhook architecture

Kros event names differ across current/older official docs, so Kros-specific event translation stays inside one adapter.

Webhook handlers must:

1. preserve raw body for signature verification
2. authenticate/verify event
3. deduplicate provider event ID
4. validate payload
5. resolve mission/provider/communication mapping
6. respond quickly with 2xx when valid
7. move heavier transcript/quote work outside the raw handler when practical
8. never create duplicate Quotes/state transitions from retries
9. log failures without secrets

## Knowledge / retrieval boundary

Durable knowledge belongs in SABI Knowledge/Bimpe KB, for example:

- trust policy
- approval policy
- procurement rules
- communication rules
- category guidance

Live facts such as today's price, availability, delivery promise, and call outcome belong in operational data/tool results, not the Knowledge Base.

## Core data entities

Minimum operational entities:

- missions
- providers
- mission_steps
- communications
- external_events
- quotes
- approvals

Potential later entities:

- users
- preferences
- memories
- orders
- payments
- escrows
- reviews
- disputes

## Failure architecture

Important flows require success + failure + recovery + terminal handling.

Examples:

- provider no answer/busy → record truthful failure; try next provider or implemented fallback
- malformed webhook → reject safely and log
- duplicate webhook → no duplicate state/Quote
- missing quote field → unknown remains unknown
- one provider fails → Mission continues when enough candidates remain
- all providers fail → Mission escalates/fails honestly
- transcript exists but lacks required facts → no fabricated Quote

## Observability

Capture at minimum:

- missionId
- providerId
- communicationId
- tool calls
- Bimpe request IDs when used
- Kros external call/event IDs
- partner status/lifecycle
- transcript/source reference
- quote extraction result
- recommendation inputs
- approval status
- errors

Do not log secrets, auth headers, or unnecessary sensitive content.

## Security

- API keys server-side only
- validate all external inputs
- least-privilege API scopes
- verify webhook signatures
- idempotent event processing
- explicit permission boundaries
- no unrestricted LLM database access
- no consequential action without explicit human approval

## Implementation principle

Do not redesign the entire app around a partner SDK. SABI domain contracts stay stable and every partner remains behind adapters/tools so providers can be swapped without rewriting Mission logic.

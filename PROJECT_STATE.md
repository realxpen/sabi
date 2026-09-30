# PROJECT_STATE.md

Status: ACTIVE
Last updated: 2026-09-30

## Current phase

**Phase 1 — MVP Skeleton / Parallel Build**

Phase 0 is complete. Xpen's shared foundation and mock Mission Control track are implemented, verified in GitHub Actions, and merged to `main`.

## Event target

- Event: Lagos Agentic AI Build Day / Hack Night
- Date: 2026-10-03
- Location: Civic Hive, Yaba, Lagos

## Current product

**SABI — AI Agent for the Informal Economy**

Core principle:

> Tell SABI what you need. SABI helps you get it done.

## Locked MVP hypothesis

An AI agent can take a user's informal-commerce request, convert it into a structured mission, discover relevant providers, communicate with real people, collect structured information, compare qualifying options, and return an actionable recommendation while preserving human approval for consequential action.

## Canonical demo mission

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Phase 0

Complete:

- [x] Product source
- [x] MVP boundary
- [x] Trust model
- [x] Team ownership
- [x] System architecture
- [x] LLM knowledge/retrieval architecture
- [x] Mission model/state machine
- [x] Integration contracts
- [x] Demo flow
- [x] Evaluation plan
- [x] Hackathon positioning
- [x] Active decisions
- [x] root AGENTS.md
- [x] root PROJECT_STATE.md
- [x] teammate-specific Codex prompts

## Phase 1A/1B — Shared foundation

PR #1 merged and verified.

Implemented:

- [x] Next.js + TypeScript application scaffold
- [x] canonical Zod schemas
- [x] Mission
- [x] Provider
- [x] Quote
- [x] MissionStep
- [x] Approval
- [x] CommunicationResult
- [x] deterministic mission state machine
- [x] provider-neutral communication adapter contract
- [x] mock communication adapter
- [x] schema/state/communication tests
- [x] GitHub CI workflow

## Phase 1C/1D — Xpen orchestration + Mission Control

PR #2 merged and verified.

Implemented:

- [x] deterministic Phase 1 mission parser for the canonical demo flow
- [x] mock mission orchestration through AWAITING_APPROVAL
- [x] explicitly labelled temporary provider/quote fixtures
- [x] MissionSnapshot orchestration contract
- [x] Home → Mission Control flow
- [x] structured mission summary
- [x] Mission Control timeline based on real stored step objects
- [x] provider response cards
- [x] temporary recommendation display
- [x] human approval UI
- [x] approval path explicitly performs no transaction
- [x] POST /api/missions Phase 1 contract
- [x] POST /api/missions/:id/approval Phase 1 contract
- [x] parser/orchestration/approval tests
- [x] responsive demo styling

Important: current provider responses and recommendation logic are clearly marked as **Phase 1 mock fixtures**. They are integration scaffolding and must be replaced by Femi/Lara modules rather than presented as live provider results.

## Partner integration research — completed 2026-09-30

The supplied public sites and integration-relevant documentation have been audited and consolidated into:

- `Raw/PartnerDocs/SOURCE_LINKS.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`

Verified:

- [x] KrosAI KYC/API-key/scopes model
- [x] KrosAI number + endpoint architecture
- [x] KrosAI outbound-call fields and lifecycle
- [x] KrosAI current webhook event/signature/retry model
- [x] KrosAI transcript/recording/log capabilities
- [x] KrosAI Vapi, Retell, ElevenLabs and LiveKit integration paths
- [x] KrosAI docs path/version inconsistency documented
- [x] Spitch TTS/STT/translation and official LiveKit plugin
- [x] YarnGPT Bearer auth, TTS, streaming synthesis and async ASR
- [x] Temlio public Voice/SMS/USSD/DID capabilities and API-doc gap
- [x] BimpeAI REST/API auth model
- [x] BimpeAI workflows/agents
- [x] BimpeAI text/URL Knowledge Bases
- [x] BimpeAI Custom API tools
- [x] BimpeAI test/live telephony capability
- [x] BimpeAI TypeScript SDK Node 24+ compatibility constraint

### Active integration plan

Primary path:

```text
SABI Next.js
→ BimpeAI workflow / Knowledge / bounded tools
→ SABI callProvider
→ KrosAI
→ Vapi first
→ provider phone
→ KrosAI event/transcript
→ CommunicationResult / Quote
→ Femi intelligence
→ Xpen Mission Control
→ human approval
```

Advanced language path only after primary flow works:

```text
KrosAI → LiveKit SIP → LiveKit agent → Spitch STT/TTS → SABI tools
```

YarnGPT remains optional voice enhancement. Temlio remains optional SMS fallback pending detailed API access.

### Integration compatibility decisions

- SABI remains the system of record for Mission, Quote, CommunicationResult and Approval.
- KrosAI remains the primary telephony transport candidate.
- Vapi is the first voice-runtime candidate; Retell/ElevenLabs are fallbacks, not simultaneous critical-path integrations.
- BimpeAI is the agent brain/knowledge/tool layer, not a replacement for Mission state.
- No verified native BimpeAI ↔ KrosAI bridge has been found; SABI-owned tools/APIs connect the layers.
- Because BimpeAI's TS SDK currently documents Node 24+ while SABI CI is Node 20, use Bimpe REST/native fetch first unless runtime migration is deliberately tested.
- Because KrosAI docs show `/v1` and `/api/v1` variants, the live route must be confirmed and kept configurable.

## CI status

Latest Xpen track verified:

- [x] dependency install
- [x] TypeScript typecheck
- [x] Vitest tests
- [x] Next.js production build
- [x] push CI
- [x] pull-request CI

## Parallel work is active

### Xpen — Product & Integration

Completed:

- Phase 1A — scaffold
- Phase 1B — shared contracts
- Phase 1C — mock mission engine
- Phase 1D — Mission Control / approval shell

Current responsibility:

- keep integration surfaces stable
- review incoming Femi/Lara work
- replace temporary fixtures with teammate modules
- connect the first full integrated mock loop
- preserve human-approval/truthfulness UX
- prepare final demo integration

### Femi — Intelligence, Data & Knowledge

Branch:

`femi/intelligence`

Use:

`Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`

Track:

- F1 demo data
- F2 hard constraints
- F3 soft ranking
- F4 quote intelligence
- F5 knowledge/retrieval
- F6 recommendation output
- F7 evaluation

Femi's implementation should replace the temporary Xpen fixture/recommendation layer rather than create a second architecture.

### Lara — Agent Tools & Communication

Branch:

`lara/agent-tools`

Must read:

- `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`

Track:

- L1 tool layer
- L2 communication adapter
- L3 event normalization
- L4 KrosAI webhook architecture
- L5 failure/recovery
- L6 KrosAI + selected voice-runtime integration
- L7 optional multilingual voice
- L8 optional Temlio fallback + observability

Lara's implementation must extend the existing adapter boundary rather than bypass Mission state/shared schemas.

## Not yet activated

- Supabase persistence
- live BimpeAI agent configuration
- live KrosAI phone integration
- live Vapi/Retell/ElevenLabs runtime
- real African-language phone flow
- live Temlio fallback
- end-to-end real provider demo
- payments / escrow

## Current blockers / access gates

- KrosAI account/KYC/phone number/API key/event credits.
- Confirmation of the actual live KrosAI REST base/path through API Explorer/minimal request.
- Selected voice-runtime credentials (Vapi first).
- BimpeAI API key/agent/workflow configuration.
- Detailed Temlio API auth/payload/webhook documentation if SMS fallback is attempted.
- LiveKit/Spitch credentials only if multilingual phone flow is attempted.
- Consenting test phone/provider participants.
- Official event restriction, if any, on pre-built implementation remains to be confirmed.

## Next integration gate

The next meaningful checkpoint is:

```text
request
→ validated mission
→ provider discovery
→ real or verified communication adapter action
→ structured quote
→ filtering/comparison
→ recommendation
→ human approval
```

First integrate Femi/Lara's mock-ready modules with Xpen's Mission Control. Then replace the communication mock with one verified KrosAI path. Do not add optional partner integrations until the primary path is stable.

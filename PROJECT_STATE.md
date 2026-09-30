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

## Partner integration research — verified 2026-09-30

Official sources supplied by the team have now been recorded in:

- `Raw/PartnerDocs/SOURCE_LINKS.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`

Verified so far:

- [x] KrosAI account/KYC/API-key model
- [x] KrosAI phone-number + endpoint architecture
- [x] KrosAI outbound-call request model
- [x] KrosAI call lifecycle/failure outcomes
- [x] KrosAI webhook event/signature model
- [x] KrosAI Vapi/Retell/ElevenLabs/LiveKit/custom endpoint options
- [x] YarnGPT Bearer auth, TTS, STT and real-time conversation audio
- [x] Spitch STT, TTS, translation, Nigerian Pidgin support and LiveKit integration
- [x] Temlio public capabilities: Voice/SMS/USSD/local numbers/RESTful integrations

Important open integration details:

- KrosAI official docs currently contain inconsistent outbound-call path examples; Lara must confirm the live API explorer/dashboard route before hard-coding it.
- Temlio's public homepage does not provide enough detailed API-contract information for implementation; event/partner documentation or credentials are still needed.
- Final KrosAI voice-provider selection remains open pending access, setup speed and live reliability testing.
- BimpeAI live integration documentation/access is still outstanding.

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

Femi's implementation should replace the temporary Xpen fixture/recommendation layer rather than create a second product architecture.

### Lara — Agent Tools & Communication

Branch:

`lara/agent-tools`

Use:

- `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Raw/PartnerDocs/SOURCE_LINKS.md`

Track:

- L1 tool layer
- L2 communication adapter
- L3 event normalization
- L4 webhook architecture
- L5 failure/recovery
- L6 verified partner integration
- L7 language/speech
- L8 observability

Lara's implementation should replace/extend the existing mock communication boundary rather than bypass Mission state or shared schemas.

## Not yet activated

- Supabase persistence
- runtime production-grade RAG
- BimpeAI live integration
- live telephony integration
- live messaging fallback
- real African-language voice flow
- end-to-end real provider demo
- payments / escrow

## Current team ownership

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

## Current blockers / unknowns

- Final partner API credentials and exact event allocations.
- Confirmed live KrosAI outbound-call route/version.
- Detailed Temlio API auth/payload/webhook documentation.
- BimpeAI API/tool documentation and access.
- Final decision on which voice/language combination gives the most reliable event demo.
- Official event restriction, if any, on pre-built implementation remains to be confirmed.

## Next integration gate

The next meaningful checkpoint is **not another standalone Xpen feature**.

Femi and Lara complete their first integration-ready slices, then Xpen integrates them into:

```text
request
→ validated mission
→ provider discovery
→ provider contact
→ structured quote
→ filtering/comparison
→ recommendation
→ human approval
```

The temporary Xpen provider/quote/recommendation fixtures are removed or bypassed as the real teammate-owned modules become available.

Only after the complete mock loop is integrated and stable should the team replace the communication mock with verified partner APIs.

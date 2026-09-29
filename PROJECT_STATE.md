# PROJECT_STATE.md

Status: ACTIVE
Last updated: 2026-09-29

## Current phase

**Phase 1 — MVP Skeleton / Parallel Build**

Phase 0 is complete. The shared Phase 1 foundation has been implemented, verified in GitHub Actions, and merged to `main`.

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
- [x] Root AGENTS.md
- [x] Root PROJECT_STATE.md
- [x] teammate-specific Codex prompts

## Phase 1 verified foundation

PR #1 — **Phase 1A/1B: shared SABI foundation** — merged.

Verified by GitHub Actions:

- [x] dependency install
- [x] TypeScript typecheck
- [x] Vitest tests
- [x] Next.js production build

Implemented:

- [x] Next.js + TypeScript application scaffold
- [x] Home mission-input shell
- [x] Mission Control route shell
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
- [x] focused schema/state/communication tests
- [x] GitHub CI workflow

## Parallel work is now authorized

The shared-contract gate has passed.

### Xpen — Product & Integration

Current work:

- Phase 1C — mock mission engine
- Phase 1D — Mission Control UI
- API/route glue
- overall integration

### Femi — Intelligence, Data & Knowledge

Branch:

`femi/intelligence`

Use:

`Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`

Current track:

- F1 demo data
- F2 hard constraints
- F3 soft ranking
- F4 quote intelligence
- F5 knowledge/retrieval
- F6 recommendation output
- F7 evaluation

### Lara — Agent Tools & Communication

Branch:

`lara/agent-tools`

Use:

`Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`

Current track:

- L1 tool layer
- L2 communication adapter
- L3 event normalization
- L4 webhook architecture
- L5 failure/recovery
- L6 verified partner integration
- L7 language/speech
- L8 observability

## Not yet activated

- Supabase persistence
- runtime production-grade RAG
- BimpeAI live integration
- live telephony integration
- live messaging fallback
- partner-specific webhook contracts
- real African-language voice flow
- end-to-end real provider demo
- payments / escrow

## Current team ownership

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

## Current blockers / unknowns

- Final partner API credentials and exact event allocations.
- Exact API/webhook contracts must be confirmed from official partner documentation/access.
- Final decision on which voice/language combination gives the most reliable event demo.
- Official event restriction, if any, on pre-built implementation remains to be confirmed.

## Next integration gate

Before adding nonessential features, the three branches must combine into:

```text
request
→ validated mission
→ providers
→ provider contact
→ structured quote
→ filtering/comparison
→ recommendation
→ human approval
```

The first complete mock end-to-end path must work before real partner adapters replace mock communication.

# AGENTS.md — SABI Agent Instructions

Status: ACTIVE
Last updated: 2026-09-30

## Purpose

This file tells AI coding agents how to operate inside the SABI repository.

SABI is an AI agent for the informal/local economy. The hackathon MVP proves that an agent can understand a user's real-world commerce request, find suitable providers, contact them, collect structured information, compare valid options, and return a recommendation while preserving meaningful human control.

## Mandatory startup sequence

Before implementing or changing code:

1. Read `PROJECT_STATE.md`.
2. Read `Knowledge/Product/SABI_PRODUCT_SOURCE.md`.
3. Read `Knowledge/Product/MVP_SCOPE.md`.
4. Read `Knowledge/Decisions/ACTIVE_DECISIONS.md`.
5. Read the relevant ACTIVE `Knowledge/` files for your track.
6. If working on integrations, read:
   - `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
   - `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
   - `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
   - `Raw/PartnerDocs/SOURCE_LINKS.md`
7. Prefer ACTIVE knowledge over DEPRECATED/ARCHIVED material.
8. Inspect existing code only after understanding current contracts.
9. Explain architectural/shared-contract changes before implementing them.

Do not treat generated code as the source of truth.

## Source-priority rule

For partner-specific implementation, use this order:

1. current official partner API/reference docs
2. current live API Explorer/dashboard/account behavior
3. ACTIVE SABI integration knowledge derived from those sources
4. older docs/examples only as historical context

If official pages conflict, do not guess. Centralize the uncertainty, verify with a minimal live request/test, then update `PARTNER_INTEGRATIONS.md` and `ACTIVE_DECISIONS.md` if architecture changes.

## Core product loop

```text
USER INTENT
→ UNDERSTAND
→ PLAN
→ DISCOVER
→ VERIFY
→ CONTACT
→ COLLECT
→ COMPARE
→ RECOMMEND
→ HUMAN APPROVAL
```

The hackathon MVP ends at approval.

## Architectural rules

1. Mission is the central operational object.
2. SABI remains system of record for Mission, Provider, CommunicationResult, Quote, recommendation state, Approval, guardrails, and correlation IDs.
3. External communications are asynchronous.
4. External results enter through explicit adapters/webhook handlers.
5. Provider responses normalize into structured Quote objects only after factual validation.
6. Agent capabilities are exposed through narrow tools.
7. The LLM/agent never receives unrestricted database/system access.
8. Context must be relevant, minimal, permission-aware, fresh enough, and traceable.
9. Consequential actions require explicit human approval.
10. The MVP must not perform real financial transactions.
11. Never fabricate provider data, price, availability, call outcome, transcript meaning, or external action.
12. Prefer simple reliable implementations over unnecessary complexity.
13. Shared schemas/contracts must not change silently.

## Current verified integration stack

Primary path:

```text
SABI Next.js
→ BimpeAI agent/workflow/Knowledge + bounded SABI tools
→ SABI callProvider
→ KrosAI telephony
→ Vapi first
→ provider phone
→ Kros event/transcript
→ CommunicationResult
→ Quote
→ Femi filtering/ranking
→ Xpen Mission Control
→ human approval
```

Advanced language path only after the base phone loop is stable:

```text
KrosAI → LiveKit → Spitch STT/TTS → SABI/Bimpe tools
```

YarnGPT is optional voice enhancement. Temlio is optional communication fallback pending detailed API access.

## Integration-specific rules

### BimpeAI

- use REST/native server-side `fetch` first under current Node 20 CI
- do not install the current Node-24+ TypeScript SDK without an intentional runtime upgrade
- use Bimpe for workflow, Knowledge Base, reasoning, and bounded Custom API tools
- do not let Bimpe replace Mission state or directly mutate unrestricted storage

### KrosAI

- primary telephony transport
- use least-privilege key scopes
- keep Kros URLs/routes centralized
- `KROSAI_BASE_URL` remains configurable because current official docs show `/v1` and `/api/v1` variants
- `initiated`/`ringing` are not completion
- verify webhook signature from raw body
- deduplicate provider event IDs
- keep old/new event-name aliases inside the Kros adapter
- live calls only to consenting test participants/providers

### Vapi / Retell / ElevenLabs

- Vapi is the first voice-runtime candidate
- if not reliable quickly, test Retell, then ElevenLabs
- do not integrate all simultaneously as critical-path dependencies

### Spitch / LiveKit

- optional multilingual enhancement after the base path is stable
- keep it isolated from Mission/domain contracts

### YarnGPT

- optional TTS/translation/streaming synthesis/post-call STT
- do not treat its single-turn synthesis endpoint as a complete voice-agent pipeline
- its documented ASR is asynchronous/polled

### Temlio

- planned first use is SMS fallback after no-answer/busy/failure
- do not invent auth/request/webhook contracts from marketing pages

## Knowledge architecture

SABI separates durable Knowledge, retrieval, memory, operational data, agent reasoning and tools.

Live provider facts belong in operational/tool data, not durable Knowledge Base entries.

## MVP scope

Build only what supports Mission creation, provider discovery/contact, Quote extraction/normalization, comparison, recommendation, human approval, Mission Control, minimal Knowledge context and truthful observability/recovery.

Do not add real payments, escrow, a full marketplace, broad autonomous purchasing, complex production KYC, or unrelated features.

## Agent guardrails

SABI must obey hard constraints, distinguish facts from unknowns, use tools for external facts/actions, preserve source/correlation references and request human approval before consequential action.

SABI must never invent provider/Quote facts, claim initiation as completion, exceed a hard budget silently, purchase/book/send/release money without permission, alter consequential constraints without approval, or create duplicate Quotes/state transitions from retried events.

## Code conventions

- TypeScript for the main app
- Zod/equivalent validation at external boundaries
- one canonical shared domain schema location
- secrets server-side only
- external providers behind adapters
- idempotent webhook/event processing where feasible
- deterministic state transitions
- success + failure + recovery tests
- logs include correlation IDs but not secrets

## Team ownership

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

Shared contracts require team agreement.

## Completion rule

Before calling a task complete:

1. confirm alignment with ACTIVE knowledge
2. run relevant tests/typecheck/build
3. test at least one important failure case
4. verify truthful state/observability
5. record meaningful decision changes
6. update `PROJECT_STATE.md` when phase/blockers/next actions change

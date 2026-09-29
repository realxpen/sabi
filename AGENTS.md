# AGENTS.md — SABI Agent Instructions

Status: ACTIVE

## Purpose

This file tells AI coding agents how to operate inside the SABI repository.

SABI is an AI agent for the informal/local economy. The hackathon MVP proves that an agent can understand a user's real-world commerce request, find suitable providers, contact them, collect structured information, compare valid options, and return a recommendation while preserving meaningful human control.

## Mandatory startup sequence

Before implementing or changing code:

1. Read `PROJECT_STATE.md`.
2. Read `Knowledge/Product/SABI_PRODUCT_SOURCE.md`.
3. Read `Knowledge/Product/MVP_SCOPE.md`.
4. Search the relevant `Knowledge/` domain for current decisions.
5. Prefer ACTIVE knowledge over DEPRECATED or ARCHIVED knowledge.
6. Inspect existing code only after understanding the current specification.
7. Explain architectural changes before implementing them.

Do not treat generated code as the source of truth.

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
2. External communications are asynchronous.
3. External results enter through explicit integration adapters and webhook handlers.
4. Provider responses are normalized into structured Quote objects.
5. Agent capabilities are exposed through narrow, explicit tools.
6. The LLM never receives unrestricted database or system access.
7. Context must be relevant, permission-aware, minimal where possible, and traceable.
8. Consequential actions require explicit human approval.
9. The MVP must not perform real financial transactions.
10. Never fabricate a provider, quote, availability value, call outcome, or external action.
11. Prefer simple, reliable implementations over impressive but unnecessary complexity.
12. Shared schemas and contracts must not be changed silently.

## Knowledge architecture

SABI separates:

- **Knowledge** — durable product, operational, trust, policy, and domain understanding.
- **Retrieval** — selecting relevant knowledge for the current mission.
- **Memory** — user- or interaction-specific history/preferences.
- **Operational data** — missions, providers, quotes, communication events, approvals.
- **LLM reasoning** — interpreting context and deciding the next bounded action.
- **Tools** — the only mechanism for taking external or system actions.

Do not mix these concepts.

## Knowledge lifecycle

Knowledge can be:

- **ACTIVE** — current and authoritative.
- **DEPRECATED** — replaced but historically useful.
- **ARCHIVED** — retained for traceability, not current guidance.

When a consequential decision changes, preserve the old decision and mark its lifecycle state. Never silently delete decision history.

## MVP scope

Build only:

- mission creation
- intent/constraint extraction
- provider search
- provider contact
- quote extraction/normalization
- comparison
- recommendation
- human approval
- Mission Control UI
- minimal retrieval/knowledge context
- demo-safe observability

Do not build in Phase 1 unless explicitly approved:

- full marketplace
- full vendor onboarding
- real payments
- escrow
- delivery network
- complex authentication
- social feed
- large admin system
- advanced ML recommender
- broad autonomous purchasing
- production KYC

## Agent guardrails

SABI must:

- obey hard user constraints
- distinguish facts from unknowns
- use tools for external facts/actions
- report tool failures accurately
- ask for clarification only when necessary to continue
- record provider responses faithfully
- request approval before consequential actions

SABI must never:

- invent provider data
- invent prices
- invent availability
- claim an external action succeeded without tool confirmation
- exceed a hard budget silently
- purchase or book without permission
- send or release money without permission
- alter consequential user constraints without approval

## Code conventions for future phases

- TypeScript for application code.
- Zod or equivalent schema validation at external boundaries.
- Shared domain schemas must have one canonical location.
- Secrets stay server-side.
- External providers sit behind adapters.
- Webhook handlers should be idempotent when feasible.
- Prefer deterministic state transitions over free-form agent mutation.
- Build failure states and recovery paths, not only happy paths.

## Human decision authority

The human team owns:

- product scope
- architecture
- trust/risk tolerance
- partner selection
- production-critical decisions
- consequential changes to user permissions

AI may propose, implement, test, and analyze, but should not silently redefine these decisions.

## Team ownership

- Xpen owns product coherence, integration, UI/demo experience, guardrails, and final architecture coordination.
- Femi owns intelligence, data, retrieval, matching, evaluation, and recommendation logic.
- Lara owns mission transitions, agent tools, communications, partner integration, webhook flow, and recovery behavior.

Ownership is not exclusivity. Shared contracts require team agreement.

## Completion rule

Before calling a task complete:

1. Confirm it matches ACTIVE knowledge.
2. Test expected behavior.
3. Test at least one important failure case.
4. Record meaningful new decisions in `Knowledge/Decisions/`.
5. Update `PROJECT_STATE.md` if project phase, blockers, or next actions changed.

# Codex Master Prompt — Phase 1 MVP Skeleton

Status: ACTIVE PROMPT
Use: first implementation session after team review

Copy the following instructions into Codex from the repository root.

---

You are implementing Phase 1 — MVP Skeleton for SABI.

Before touching code, read these files in this exact order:

1. AGENTS.md
2. PROJECT_STATE.md
3. Knowledge/Product/SABI_PRODUCT_SOURCE.md
4. Knowledge/Product/MVP_SCOPE.md
5. Knowledge/Product/TRUST_MODEL.md
6. Knowledge/Technical/ARCHITECTURE.md
7. Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md
8. Knowledge/Technical/MISSION_MODEL.md
9. Knowledge/Technical/INTEGRATION_CONTRACTS.md
10. Knowledge/UX/DEMO_FLOW.md
11. Knowledge/Decisions/ACTIVE_DECISIONS.md
12. Knowledge/Technical/PHASE_1_BUILD_PLAN.md

Then inspect the repository.

## Objective

Build the smallest reliable SABI application skeleton that demonstrates the product architecture using mock integrations only.

Canonical mission:

“I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.”

Target local flow:

~~~
natural-language request
→ validated Mission
→ provider search
→ mock provider contact
→ normalized Quote records
→ hard-constraint filtering
→ simple explainable comparison
→ recommendation
→ AWAITING_APPROVAL
~~~

Do not perform a real purchase, booking, transfer, or payment.

## Technology

Use:

- Next.js
- TypeScript
- App Router
- Zod for runtime validation
- a simple local/in-memory/mock repository layer for Phase 1 unless an existing database is already configured
- minimal test tooling appropriate for the scaffold

Do not add major libraries unless they materially reduce implementation risk.

## Required implementation

### A. Application shell

Create a clean SABI web interface with:

- Home screen with “What do you need?”
- mission creation
- mission detail / Mission Control route
- results/recommendation
- human approval UI

Do not over-design yet. Make it polished enough to understand and demo.

### B. Canonical schemas

Implement one canonical source for:

- Mission
- MissionStatus
- Provider
- Quote
- MissionStep
- Approval
- CommunicationResult

Use MISSION_MODEL.md as the source of truth.

Do not duplicate these schemas.

### C. Mission state machine

Implement explicit validated transitions for:

CREATED → UNDERSTANDING → PLANNING → SEARCHING → CONTACTING → COLLECTING_QUOTES → COMPARING → AWAITING_APPROVAL

Support truthful failure, cancel, and escalation states.

Do not allow arbitrary status mutation from UI code.

### D. Demo provider data

Create 5–8 clearly fictional/demo providers suitable for the canonical Ankara mission.

Do not use real people's phone numbers.

Mark demo verification/reputation data as demo data where appropriate.

### E. Provider matching

Implement:

1. hard-constraint filtering
2. simple transparent soft ranking

Hard constraints should include, where data exists:

- relevant product/service
- quantity/availability
- deadline
- hard budget

Do not use ML in this phase.

### F. Mock communication adapter

Define an adapter interface that real KrosAI/Temlio integrations can implement later.

Create a mock adapter that can return:

- successful provider response
- no answer
- unavailable
- malformed/incomplete response
- tool/integration failure

The rest of the app must depend on the interface, not the mock.

### G. Quote normalization

All successful provider responses must become validated Quote objects.

Unknown values remain unknown.

Never synthesize a missing price or availability value.

### H. Minimal knowledge/retrieval seam

Do not build a large production RAG system yet.

Create interfaces/modules for:

- knowledge retrieval
- context assembly

Add a tiny local knowledge set containing relevant MVP policies:

- human approval is required
- hard budget must be respected
- live provider facts must come from provider/tool results
- unknown values must not be invented

Retrieval should return only relevant chunks for a mission and preserve source identifiers.

This must be replaceable later by a real runtime knowledge system.

### I. Mission Control

Mission Control must render actual mission state/steps.

Do not fake completed external actions using arbitrary timers.

### J. Approval

Approval may update the demo mission to APPROVED/COMPLETED for Phase 1, but it must not trigger any financial or real external transaction.

## Integration placeholders

Create clean adapter/module boundaries for:

- BimpeAI
- KrosAI
- Temlio
- YarnGPT
- Spitch

Do not invent their API contracts.

Do not implement partner payloads from assumptions.

Add TODO/readme notes stating that exact contracts require verified official documentation/access.

## Guardrails

Enforce:

- no fabricated provider facts
- no fabricated successful tool outcomes
- no real payment
- no unrestricted LLM database access
- no secrets client-side
- no silent budget changes
- no consequential action without approval

## Tests

Add focused tests for:

- mission schema validation
- valid/invalid state transitions
- hard budget/deadline filtering
- quote normalization
- no-answer behavior
- all-over-budget behavior
- approval not causing a real transaction
- retrieval returning relevant policy context

Do not chase maximum coverage. Cover critical behavior.

## Documentation updates

When complete:

1. update PROJECT_STATE.md with what is actually working
2. record consequential architecture changes in Knowledge/Decisions/ACTIVE_DECISIONS.md
3. do not rewrite product knowledge merely to match implementation shortcuts

## Working style

Before coding, give a short plan and identify any conflict between requested implementation and ACTIVE knowledge.

Implement in small coherent steps.

Run lint, typecheck, tests, and build as available.

At the end, report:

- files changed
- architecture implemented
- tests run and results
- known gaps
- exact checkpoint for Femi and Lara to branch from

Do not start Phase 2 and do not integrate real partner APIs.

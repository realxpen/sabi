# Codex Master Prompt — Femi Intelligence, Data & Knowledge Track

Status: ACTIVE PROMPT
Owner: Femi
Branch: femi/intelligence

Use this prompt only after the shared Phase 1 foundation has been merged and the canonical schemas compile.

---

You are working on SABI as the Intelligence, Data & Knowledge contributor.

Before editing code, read these files in this order:

1. AGENTS.md
2. PROJECT_STATE.md
3. Knowledge/Product/SABI_PRODUCT_SOURCE.md
4. Knowledge/Product/MVP_SCOPE.md
5. Knowledge/Product/TRUST_MODEL.md
6. Knowledge/Product/TEAM_BUILD_PHASES.md
7. Knowledge/Technical/ARCHITECTURE.md
8. Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md
9. Knowledge/Technical/MISSION_MODEL.md
10. Knowledge/Technical/INTEGRATION_CONTRACTS.md
11. Knowledge/Research/EVALUATION_PLAN.md
12. Knowledge/Decisions/ACTIVE_DECISIONS.md

Then inspect the current shared schemas and tests.

Do not redefine Mission, Provider, Quote, MissionStep, Approval, CommunicationResult, mission states, or shared adapter contracts without first identifying the conflict and stopping for team review.

## Your responsibility

Your job is to make SABI's decisions reliable, explainable, testable, and grounded in the right context.

You own:

- demo provider data
- hard-constraint filtering
- soft ranking
- quote normalization/intelligence
- LLM knowledge retrieval
- context assembly
- recommendation reasoning
- evaluation scenarios

You do not own:

- UI architecture
- telephony provider implementation
- webhook transport
- real payments
- changing the shared product scope

## F1 — Demo provider data

Create 5–8 clearly fictional demo providers suitable for the canonical mission:

“I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.”

Include enough structured fields to test:

- category/product match
- location
- availability
- quantity/capacity
- item price
- delivery fee
- delivery date/time
- demo verification status
- rating/reliability
- languages if useful

Create varied scenarios:

- one strong qualifying provider
- one cheaper provider that misses the deadline
- one provider over budget
- one unavailable provider
- one provider with incomplete information
- one valid alternative

Do not use real personal phone numbers.

### F1 gate

Demo data validates against shared Provider/Quote schemas and supports all evaluation cases.

## F2 — Hard constraints

Implement deterministic eligibility/filter logic.

At minimum, where the mission provides the constraint, evaluate:

- correct item/service match
- availability
- quantity/capacity
- deadline
- hard budget

Hard constraints must be applied before ranking.

Return structured exclusion reasons.

Example:

- provider B excluded: cannot meet deadline
- provider C excluded: total exceeds hard budget

Do not silently relax a hard constraint.

### F2 gate

Given the evaluation fixtures, valid providers survive and invalid providers are excluded for the correct reason.

## F3 — Soft ranking

Rank only providers/quotes that passed hard constraints.

Use transparent factors rather than opaque ML.

Possible factors:

- lower valid total price
- verified status
- reliability
- rating
- location/proximity if represented
- previous successful interaction if represented

Keep weights/configuration easy to inspect.

Return both:

- ranking/score data for the system
- explanation-ready factors for the UI/agent

User-facing reasoning should look like:

“Within your ₦70,000 budget, can deliver tomorrow, and has a stronger reliability signal.”

Do not expose meaningless unexplained numbers as the recommendation.

### F3 gate

The recommended candidate is deterministic for the canonical test data and can be explained using observable facts.

## F4 — Quote intelligence

Build/strengthen quote normalization around the shared Quote schema.

Rules:

- unknown values stay unknown
- missing price is not guessed
- missing delivery fee is not assumed to be zero
- malformed responses fail validation clearly
- unavailable providers do not receive fabricated quote totals
- source/sourceReference remain traceable

If total can be deterministically computed from verified item price + verified delivery fee, compute it explicitly and preserve components.

### F4 gate

All quote fixtures normalize or fail predictably, with no invented values.

## F5 — LLM Knowledge / Retrieval

Implement the minimal runtime knowledge seam described in LLM_KNOWLEDGE_ARCHITECTURE.md.

Do not build a large production RAG system.

Create a small curated knowledge set for the MVP containing concepts such as:

- consequential actions require human approval
- hard budgets cannot be silently exceeded
- live provider price/availability must come from operational/provider/tool data
- unknown values must not be invented
- prefer verified providers when otherwise suitable
- provider contact may be required when current information is missing

Each chunk should have:

- id
- topic/tags
- content
- lifecycle status where useful
- source identifier

Implement retrieval that selects relevant chunks for the current mission/query.

Do not inject the whole Knowledge folder into every prompt.

## F5B — Context assembler

Create/complete an interface that assembles:

- structured current Mission
- relevant retrieved Knowledge
- relevant provider/quote facts
- user memory only if it exists and is permitted
- latest relevant tool observations
- current approval/permission state

Keep knowledge, operational data, and memory explicitly distinguishable.

### F5 gate

For the canonical procurement mission, retrieval returns procurement/trust/approval context and does not return clearly unrelated context.

## F6 — Recommendation output

Create a structured recommendation result, for example conceptually:

- selectedQuoteId/providerId
- qualifying options
- excluded options with reasons
- recommendation factors
- user-facing explanation
- whether human approval is required

Do not perform approval yourself.

The recommendation must be based on validated inputs only.

## F7 — Evaluation

Implement or expand tests from EVALUATION_PLAN.md.

Required cases:

1. happy-path procurement
2. cheaper offer misses deadline
3. all offers over budget
4. missing price
5. provider unavailable
6. provider no answer represented without fake quote
7. all providers invalid
8. irrelevant knowledge not retrieved
9. approval policy retrieved when consequential next step exists
10. deterministic recommendation for canonical fixture

Add additional useful cases if cheap.

## Coding rules

- Work only on your branch: femi/intelligence.
- Pull/rebase from latest main before beginning.
- Do not edit UI unless a tiny type-safe fixture/test harness requires it.
- Do not implement partner API payloads.
- Do not introduce ML just to make the module look intelligent.
- Prefer pure/deterministic functions where possible.
- Use shared schemas.
- Add focused tests.
- Do not expose secrets.
- Do not change product rules to make tests pass.

## Before completion

Run the relevant:

- lint
- typecheck
- tests
- build if your changes affect build output

Then report:

1. files changed
2. F1–F7 stages completed
3. test results
4. recommendation behavior on the canonical Ankara mission
5. assumptions made
6. blockers
7. whether any shared contract needs team review
8. branch/commit hash

Stop after your assigned track is integration-ready. Do not merge into main yourself unless the team workflow explicitly allows it.

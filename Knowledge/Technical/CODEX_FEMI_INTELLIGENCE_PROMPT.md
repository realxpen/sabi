# Codex Master Prompt — Femi Intelligence, Data & Knowledge Track

Status: ACTIVE PROMPT
Owner: Femi
Branch: `femi/intelligence`
Last updated: 2026-09-30

Use this prompt after pulling/rebasing the latest `main`.

---

You are working on SABI as the Intelligence, Data & Knowledge contributor.

Before editing code, read these files in this order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `Knowledge/Product/SABI_PRODUCT_SOURCE.md`
4. `Knowledge/Product/MVP_SCOPE.md`
5. `Knowledge/Product/TRUST_MODEL.md`
6. `Knowledge/Product/TEAM_BUILD_PHASES.md`
7. `Knowledge/Technical/ARCHITECTURE.md`
8. `Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md`
9. `Knowledge/Technical/MISSION_MODEL.md`
10. `Knowledge/Technical/INTEGRATION_CONTRACTS.md`
11. `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
12. `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
13. `Knowledge/Research/EVALUATION_PLAN.md`
14. `Knowledge/Decisions/ACTIVE_DECISIONS.md`

Then inspect the current shared schemas, Mission engine and tests.

Do not redefine Mission, Provider, Quote, MissionStep, Approval, CommunicationResult, mission states, or shared adapter contracts without first identifying the conflict and stopping for team review.

## Your responsibility

Make SABI's provider selection and recommendations reliable, explainable, testable, and grounded in the right knowledge/data.

You own:

- demo provider/quote data
- hard-constraint filtering
- soft ranking
- quote normalization/intelligence
- runtime Knowledge retrieval
- context assembly
- recommendation reasoning
- Bimpe Knowledge-Base content mapping
- evaluation scenarios

You do **not** own:

- UI architecture
- telephony transport
- webhook transport
- partner voice-runtime setup
- real payment/escrow
- changing product scope/shared contracts unilaterally

## F1 — Demo provider / Quote fixtures

Create 5–8 clearly fictional providers/fixtures that support the canonical mission:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

Include scenarios for:

- one strong qualifying provider
- cheaper offer missing the deadline
- over-budget offer
- unavailable provider
- incomplete quote
- valid alternative
- no-answer communication represented without a fake Quote

Never use real personal phone numbers in fixtures.

### F1 gate

All fixtures validate against shared schemas and cover evaluation cases.

## F2 — Hard constraints

Implement deterministic eligibility filtering.

Where Mission data provides the constraint, check:

- correct item/service match
- availability
- quantity/capacity
- deadline
- hard budget
- any explicit user constraint

Return structured exclusion reasons.

Never silently relax a hard constraint.

### F2 gate

Invalid options are excluded for the correct reason; valid options survive.

## F3 — Soft ranking

Rank only candidates that passed hard constraints.

Use transparent factors such as:

- valid total price
- verification signal
- reliability
- rating
- location/proximity where represented
- previous successful interaction where represented

Return:

- system ranking/score data
- explanation-ready factual factors

Do not expose meaningless black-box numbers as the user explanation.

### F3 gate

Canonical recommendation is deterministic and explainable from observable facts.

## F4 — Quote intelligence

Normalize factual provider observations to the shared Quote schema.

Rules:

- unknown remains unknown
- missing delivery fee is not assumed zero
- malformed observations fail clearly
- unavailable/no-answer providers do not get fabricated totals
- transcript alone is evidence, not automatically a Quote
- preserve source/sourceReference back to call/message/transcript
- deterministically compute total only when its verified components exist

### F4 gate

Quote fixtures normalize or fail predictably without invented values.

## F5 — Runtime Knowledge / retrieval

Implement the minimal SABI retrieval seam.

Curated knowledge should cover concepts such as:

- human approval is required for consequential actions
- hard budgets cannot be silently exceeded
- live provider price/availability must come from operational/tool data
- unknown values must not be invented
- verification is a signal, not a guarantee
- provider contact may be required when current facts are missing

Each chunk should have:

- id
- topic/tags
- content
- lifecycle status when useful
- source identifier

Do not inject the entire Knowledge folder into every prompt.

### Context assembler

Assemble only relevant:

- Mission
- retrieved Knowledge
- provider/Quote facts
- user memory if available/permitted
- latest tool observations
- approval/permission state

Keep Knowledge, operational data and memory distinguishable.

### F5 gate

The canonical procurement Mission retrieves procurement/trust/approval guidance and not unrelated material.

## F6 — BimpeAI Knowledge-Base mapping

BimpeAI is now the planned workflow/agent/Knowledge/bounded-tool layer.

Prepare a small curated set of Knowledge content suitable for Bimpe text/URL Knowledge Bases, for example:

- SABI trust policy
- approval policy
- procurement rules
- provider communication rules
- category guidance
- truthfulness/fraud guardrails

Do **not** place live operational facts in the Bimpe KB, including:

- today's provider price
- current availability
- delivery promise
- current call/transcript result

Those remain SABI operational/tool data.

Your output should be reusable whether Bimpe is configured manually in Console or through REST.

### F6 gate

We have a small, non-contradictory KB set that grounds agent reasoning without contaminating it with stale live facts.

## F7 — Recommendation output

Return a structured recommendation result with concepts such as:

- selectedQuoteId/providerId
- qualifying options
- excluded options + reasons
- recommendation factors
- factual user-facing explanation
- whether human approval is required

Do not perform approval yourself.

## F8 — Evaluation

Required cases:

1. happy-path procurement
2. cheaper offer misses deadline
3. all offers over budget
4. missing price
5. provider unavailable
6. no-answer represented without fake Quote
7. all providers invalid
8. irrelevant Knowledge not retrieved
9. approval policy retrieved for consequential next step
10. transcript missing required Quote fields
11. deterministic canonical recommendation
12. duplicated/contradictory Knowledge does not silently override ACTIVE policy

## Coding rules

- work only on `femi/intelligence`
- pull/rebase latest `main` first
- do not edit telephony/webhook partner code
- avoid UI changes except tiny fixture/test harness needs
- use shared schemas
- prefer pure/deterministic functions
- add focused tests
- do not introduce ML merely to make the module look intelligent
- do not change product rules to make tests pass
- never commit secrets

## Before completion

Run relevant:

- lint
- typecheck
- tests
- build if affected

Report:

1. files changed
2. F1–F8 stages completed
3. test results
4. canonical Ankara recommendation behavior
5. Knowledge/Bimpe-KB artifacts produced
6. assumptions
7. blockers
8. shared-contract questions
9. branch/commit hash

Stop when your track is integration-ready. Do not merge into `main` unless the team workflow explicitly allows it.

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

## Responsibility

Make SABI's provider selection and recommendations reliable, explainable, testable, and grounded in the correct knowledge and operational data.

You own:

- demo provider/Quote data
- hard-constraint filtering
- soft ranking
- Quote normalization/intelligence
- runtime Knowledge retrieval
- context assembly
- recommendation reasoning
- Bimpe Knowledge-Base content mapping
- evaluation scenarios

You do not own UI architecture, telephony transport, webhook transport, partner voice-runtime setup, real payment/escrow, or unilateral shared-contract changes.

## F1 — Demo provider / Quote fixtures

Create 5–8 clearly fictional providers/fixtures supporting the canonical mission.

Include:

- one strong qualifying provider
- cheaper offer missing deadline
- over-budget offer
- unavailable provider
- incomplete quote
- valid alternative
- no-answer communication represented without a fake Quote

Never use real personal phone numbers in fixtures.

## F2 — Hard constraints

Check, where present:

- item/service match
- availability
- quantity/capacity
- deadline
- hard budget
- explicit user constraints

Return structured exclusion reasons and never silently relax a hard constraint.

## F3 — Soft ranking

Rank only qualifying candidates using transparent factors such as valid total price, verification, reliability, rating, location/proximity and previous successful interaction where represented.

Return explanation-ready factual reasons, not only opaque scores.

## F4 — Quote intelligence

Rules:

- unknown remains unknown
- missing delivery fee is not assumed zero
- malformed observations fail clearly
- unavailable/no-answer providers get no fabricated totals
- transcript is evidence, not automatically Quote data
- preserve source/sourceReference
- compute totals only from verified components

## F5 — Runtime Knowledge / retrieval

Create/select only relevant chunks for a Mission.

Include policies such as:

- human approval for consequential actions
- hard budget protection
- live provider price/availability from operational/tool data
- unknown values are not invented
- verification is a signal, not guarantee
- provider contact may be required for missing current facts

Keep Knowledge, operational data and user memory distinguishable.

## F6 — BimpeAI Knowledge-Base mapping

Prepare a small curated set suitable for Bimpe text/URL Knowledge Bases:

- trust policy
- approval policy
- procurement rules
- provider communication rules
- category guidance
- truthfulness/fraud guardrails

Do not place current provider price, availability, delivery promises or call results in the Bimpe KB.

## F7 — Recommendation output

Return structured:

- selected provider/Quote
- qualifying options
- excluded options + reasons
- recommendation factors
- factual user-facing explanation
- approval-required flag

Do not perform approval yourself.

## F8 — Evaluation

Required cases:

1. happy path
2. cheaper offer misses deadline
3. all offers over budget
4. missing price
5. unavailable provider
6. no-answer without fake Quote
7. all providers invalid
8. irrelevant Knowledge not retrieved
9. approval policy retrieved for consequential next step
10. transcript missing required Quote fields
11. deterministic canonical recommendation
12. deprecated/irrelevant Knowledge does not override ACTIVE policy

## Coding rules

- work only on `femi/intelligence`
- pull/rebase latest `main` first
- do not edit telephony/webhook partner code
- avoid UI changes except tiny fixture/test harness needs
- use shared schemas
- prefer pure/deterministic functions
- add focused tests
- do not introduce ML merely to look intelligent
- do not change product rules to make tests pass
- never commit secrets

## Before completion

Run relevant lint/typecheck/tests/build and report:

1. files changed
2. F1–F8 completed
3. test results
4. canonical Ankara recommendation behavior
5. Knowledge/Bimpe-KB artifacts
6. assumptions
7. blockers
8. shared-contract questions
9. branch/commit hash

Stop when integration-ready. Do not merge to `main` unless the team workflow explicitly allows it.

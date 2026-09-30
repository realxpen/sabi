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

Make SABI's provider selection and recommendations reliable, explainable, testable, and grounded in correct knowledge and operational data.

You own demo provider/Quote data, hard constraints, transparent ranking, Quote intelligence, runtime Knowledge retrieval/context assembly, recommendation reasoning, Bimpe Knowledge-Base content mapping and evaluation.

You do not own UI architecture, telephony transport, webhook transport, partner voice-runtime setup, real payment/escrow, or unilateral shared-contract changes.

## F1 — Demo provider / Quote fixtures

Create 5–8 clearly fictional providers/fixtures supporting the canonical Mission, including a strong qualifying provider, cheaper deadline failure, over-budget offer, unavailable provider, incomplete quote, valid alternative and no-answer communication without a fake Quote.

Never use real personal phone numbers in fixtures.

## F2 — Hard constraints

Check item/service match, availability, quantity/capacity, deadline, hard budget and explicit user constraints where present.

Return structured exclusion reasons. Never silently relax hard constraints.

## F3 — Soft ranking

Rank only qualifying candidates using transparent factors such as valid total price, verification, reliability, rating, location/proximity and previous successful interaction where represented.

Return factual explanation-ready reasons, not only opaque scores.

## F4 — Quote intelligence

- unknown remains unknown
- missing delivery fee is not assumed zero
- malformed observations fail clearly
- unavailable/no-answer providers get no fabricated totals
- transcript is evidence, not automatically Quote data
- preserve source/sourceReference
- compute totals only from verified components

## F5 — Runtime Knowledge / retrieval

Retrieve only Mission-relevant knowledge such as approval rules, budget protection, truthfulness, verification caveats and rules for missing live facts.

Keep Knowledge, operational data and memory distinguishable.

## F6 — BimpeAI Knowledge-Base mapping

Prepare a small curated set suitable for Bimpe text/URL Knowledge Bases:

- trust policy
- approval policy
- procurement rules
- provider communication rules
- category guidance
- truthfulness/fraud guardrails

Do not place current provider price, availability, delivery promises or call results in durable KB content.

## F7 — Recommendation output

Return structured selected provider/Quote, qualifying options, exclusions + reasons, recommendation factors, factual user-facing explanation and approval-required flag.

Do not perform approval.

## F8 — Evaluation

Cover happy path, deadline conflict, all-over-budget, missing price, unavailable, no-answer without fake Quote, all invalid, irrelevant Knowledge, approval policy retrieval, transcript missing Quote fields, deterministic canonical recommendation and ACTIVE-vs-deprecated Knowledge priority.

## Coding rules

- work only on `femi/intelligence`
- pull/rebase latest `main`
- do not edit telephony/webhook partner code
- avoid UI changes except tiny test harness needs
- use shared schemas
- prefer pure/deterministic functions
- add focused tests
- do not add ML merely to look intelligent
- never commit secrets

## Before completion

Run relevant lint/typecheck/tests/build and report files changed, F1–F8 completion, test results, canonical recommendation behavior, Knowledge/Bimpe-KB artifacts, assumptions, blockers, shared-contract questions and branch/commit hash.

Stop when integration-ready. Do not merge to `main` unless the team workflow explicitly allows it.

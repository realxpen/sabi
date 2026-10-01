# Femi Intelligence Evaluation Matrix

Status: ACTIVE EVALUATION NOTE
Owner: Femi
Last updated: 2026-10-01

This matrix records the expected behavior of SABI's deterministic intelligence layer.

It is designed to prove that missing facts remain unknown, hard constraints cannot be silently relaxed, soft ranking is deterministic, and durable Knowledge stays separate from live operational data.

## Decision states

```text
READY
BLOCKED_UNKNOWN
NO_VALID_OPTIONS
```

- `READY` means at least one candidate passed every represented hard constraint.
- `BLOCKED_UNKNOWN` means no final recommendation can be issued because a hard fact is missing.
- `NO_VALID_OPTIONS` means every candidate has at least one hard failure.

## Evaluation cases

| Case | Expected result | Required assertion |
| --- | --- | --- |
| Canonical Ankara: 20 yards, Yaba, tomorrow, ₦70k | `BLOCKED_UNKNOWN` | quantity/capacity is not represented in Quote; no final recommendation |
| Same Ankara mission without a quantity constraint | `READY` | Ade is selected deterministically from represented facts |
| Cheaper option misses tomorrow deadline | candidate `FAIL` | `DEADLINE_MISMATCH` |
| Option exceeds hard budget | candidate `FAIL` | `OVER_BUDGET` |
| Missing delivery fee and no factual total | candidate `UNKNOWN` | `TOTAL_UNKNOWN` + `BUDGET_UNVERIFIED`; fee is never assumed zero |
| Missing delivery date with hard deadline | candidate `UNKNOWN` | `DEADLINE_UNKNOWN` |
| Provider inactive | candidate `FAIL` | `PROVIDER_UNAVAILABLE` |
| Quote unavailable | candidate `FAIL` | `QUOTE_UNAVAILABLE` |
| Wrong category | candidate `FAIL` | `ITEM_CATEGORY_MISMATCH` |
| No-answer communication | no fabricated Quote | CommunicationResult remains evidence/observation only |
| Every candidate fails | `NO_VALID_OPTIONS` | selected recommendation absent |
| Candidate has only missing hard facts | `BLOCKED_UNKNOWN` | candidate may appear in `pendingEvidence`, never `selected` |
| Repeat same inputs | identical ordering | deterministic selected/alternative/pending ordering |
| Approval required Mission | output preserves `true` | intelligence does not relax approval |
| Approval not required Mission | output preserves `false` | intelligence does not invent approval |
| Default Knowledge retrieval | ACTIVE relevant entries only | approval/procurement/truthfulness retrieved; irrelevant topics omitted |
| Explicit Knowledge topic request | requested ACTIVE topic returned | explicit retrieval does not depend on accidental keyword match |
| Live price/provider facts | excluded from durable Knowledge | price/provider names remain operational data |
| Communication observations | separate context lane | not durable Knowledge and not automatically Quote |
| User memory | separate context lane | does not become policy/Knowledge |
| Quote provenance | preserved | source/sourceReference remain attached to evaluated Quote |
| Ranking factors | documented fields only | price, verification, reliability, rating; no invented score |

## Canonical Ankara finding

Canonical Mission:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

Current shared Mission contract represents:

```text
quantity = 20
unit = yards
budget = 70000
deadline = tomorrow
location = Yaba
```

Current shared Quote contract does not represent exact confirmed quantity/capacity.

Therefore the strict hard-constraint result is:

```text
quantity/capacity = UNKNOWN
```

The intelligence layer may rank Ade first inside `pendingEvidence` to prioritize which provider/Quote to verify first, but must not return Ade as a final qualifying recommendation until the quantity fact is represented through a reviewed canonical contract.

This finding is the concrete evaluation evidence supporting a possible smallest shared Quote-contract extension such as explicit quantity/unit fields. That change is intentionally **not** made here because shared-contract changes require team review.

## Source-of-truth audit

### `TRUST_MODEL.md`

Rule: unknown values remain unknown and explicit approval controls consequential action.

Implementation:

- tri-state hard constraints;
- unknown facts block final qualification;
- `approvalRequired` is preserved from Mission;
- no-answer creates no Quote.

Status: aligned.

### `INTEGRATION_CONTRACTS.md`

Rule: `compareQuotes` loads validated Mission/Quotes, applies hard constraints, ranks only qualifying options, and preserves exclusions/reasons.

Implementation:

- `evaluateCandidates` runs before ranking;
- `rankQualifyingCandidates` accepts `PASS` candidates only;
- failures and uncertainties are returned separately;
- Quote source/sourceReference is preserved.

Status: aligned.

### `LLM_KNOWLEDGE_ARCHITECTURE.md`

Rule: durable Knowledge, operational data, memory and tool observations are separate; ACTIVE Knowledge wins; live facts do not enter durable Knowledge.

Implementation:

- context assembler exposes separate lanes;
- retrieval returns ACTIVE durable entries;
- live providers/Quotes remain operational data;
- communication observations and user memory have dedicated lanes;
- Knowledge and Quote provenance are recorded separately.

Status: aligned.

### `ACTIVE_DECISIONS.md` D-013

Rule: hard-constraint filtering plus transparent deterministic soft ranking.

Implementation:

- hard constraints use PASS/FAIL/UNKNOWN;
- only PASS candidates are recommendation-eligible;
- ranking uses factual represented fields only;
- deterministic IDs break final ties.

Status: aligned.

### `ACTIVE_DECISIONS.md` D-015

Rule: no silent shared-contract changes.

Implementation:

- Mission/Quote/Provider/Communication schemas are unchanged;
- quantity/capacity deficiency is surfaced as UNKNOWN;
- proposed schema extension is documented for review only.

Status: aligned.

### `ACTIVE_DECISIONS.md` D-026

Rule: durable guidance belongs in Knowledge; live price, availability, delivery promise, transcript and call outcome remain operational.

Implementation:

- Knowledge corpus contains policy/guidance only;
- runtime facts remain in Quote/provider/communication lanes.

Status: aligned.

## Remaining evaluation work after this matrix

The following require external/team integration rather than isolated intelligence logic:

1. validated transcript extraction into canonical Quote fields;
2. reviewed shared quantity/capacity representation;
3. real provider runtime evidence;
4. Bimpe Knowledge Base transport/runtime verification;
5. Vercel Preview exercise after CI/build succeeds.

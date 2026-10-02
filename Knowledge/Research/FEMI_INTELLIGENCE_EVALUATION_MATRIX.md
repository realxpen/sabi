# Femi Intelligence Evaluation Matrix

Status: ACTIVE EVALUATION NOTE
Owner: Femi
Last updated: 2026-10-02

This matrix records the expected behavior of SABI's deterministic intelligence layer.

It is designed to prove that missing facts remain unknown, hard constraints cannot be silently relaxed, soft ranking is deterministic, provider-confirmed quantity is evidence-bound, and durable Knowledge stays separate from live operational data.

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
| Canonical Ankara with explicit provider confirmation of 20 yards | `READY` | Ade is selected deterministically at ₦63,000; quantity/budget/deadline all pass |
| Same Ankara mission but provider quantity absent | `BLOCKED_UNKNOWN` | generic availability does not prove 20 yards; no final recommendation from that candidate |
| Provider confirms more than requested | candidate `PASS` | represented capacity satisfies hard quantity |
| Provider confirms less than requested | candidate `FAIL` | `QUANTITY_CAPACITY_INSUFFICIENT` |
| Provider quantity present but required unit missing | candidate `UNKNOWN` | quantity cannot be compared safely |
| Provider quantity unit incompatible with Mission unit | candidate `FAIL` | `QUANTITY_UNIT_MISMATCH` |
| Simple `yard` / `yards` variation | candidate `PASS` | simple singular/plural normalization is compatible |
| Cheaper option misses tomorrow deadline | candidate `FAIL` | `DEADLINE_MISMATCH` |
| Option exceeds hard budget | candidate `FAIL` | `OVER_BUDGET` |
| Missing delivery fee and no factual total | candidate `UNKNOWN` | `TOTAL_UNKNOWN` + `BUDGET_UNVERIFIED`; fee is never assumed zero |
| Missing delivery date with hard deadline | candidate `UNKNOWN` | `DEADLINE_UNKNOWN` |
| Provider inactive | candidate `FAIL` | `PROVIDER_UNAVAILABLE` |
| Quote unavailable | candidate `FAIL` | `QUOTE_UNAVAILABLE` |
| Wrong category | candidate `FAIL` | `ITEM_CATEGORY_MISMATCH` |
| No-answer communication | no fabricated Quote | CommunicationResult remains lifecycle evidence only |
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

Mission hard constraints include:

```text
quantity = 20
unit = yards
budget = 70000
deadline = tomorrow
location = Yaba
```

D-028 intentionally extends canonical Quote with optional provider-evidence fields:

```text
quantity?
unit?
```

They are populated only when the provider explicitly confirmed or quoted the amount. They are never copied from the Mission merely because the Mission requested 20 yards.

### Explicit quantity evidence

For the canonical fictional Ade path:

```text
provider confirms 20 yards
price = ₦60,000
deliveryFee = ₦3,000
total = ₦63,000
deliveryDate = tomorrow
```

Expected result:

```text
quantity/capacity = PASS
budget = PASS
deadline = PASS
candidate = PASS
recommendation = READY
selected = Ade
approvalRequired = true
```

### Missing quantity evidence

If the same provider only yields generic:

```text
available = true
quantity = absent
```

Expected result:

```text
quantity/capacity = UNKNOWN
candidate = UNKNOWN
```

If there is no other PASS candidate, recommendation is `BLOCKED_UNKNOWN`. This preserves the original unknown-is-unknown rule.

## Source-of-truth audit

### `TRUST_MODEL.md`

Rule: unknown values remain unknown and explicit approval controls consequential action.

Implementation:

- tri-state hard constraints;
- absent provider quantity stays UNKNOWN;
- `approvalRequired` is preserved from Mission;
- no-answer creates no Quote.

Status: aligned.

### `INTEGRATION_CONTRACTS.md`

Rule: `compareQuotes` loads validated Mission/Quotes, applies hard constraints, ranks only qualifying options, and preserves exclusions/reasons. Provider-confirmed quantity is factual operational data.

Implementation:

- `evaluateCandidates` runs before ranking;
- `rankQualifyingCandidates` accepts `PASS` candidates only;
- quantity/unit can satisfy or fail the hard quantity constraint when represented;
- missing quantity remains uncertainty;
- Quote source/sourceReference is preserved.

Status: aligned.

### `LLM_KNOWLEDGE_ARCHITECTURE.md`

Rule: durable Knowledge, operational data, memory and tool observations are separate; ACTIVE Knowledge wins; live facts do not enter durable Knowledge.

Implementation:

- context assembler exposes separate lanes;
- retrieval returns ACTIVE durable entries;
- live providers/Quotes remain operational data;
- provider-confirmed quantity remains Quote/operational data;
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

### `ACTIVE_DECISIONS.md` D-015 + D-028

Rule: shared contracts must not change silently; Quote quantity/capacity evidence is a coordinated change.

Implementation:

- D-028 records optional `Quote.quantity` / `Quote.unit`;
- fields mean provider-confirmed evidence only;
- generic `available: true` is not capacity proof;
- missing quantity remains UNKNOWN;
- insufficient quantity and incompatible units fail explicitly.

Status: aligned.

### `ACTIVE_DECISIONS.md` D-026

Rule: durable guidance belongs in Knowledge; live price, availability, delivery promise, transcript and call outcome remain operational.

Implementation:

- Knowledge corpus contains policy/guidance only;
- runtime facts remain in Quote/provider/communication lanes.

Status: aligned.

## Remaining evaluation work

The remaining work is external/runtime proof rather than isolated intelligence logic:

1. redeploy the integration preview after Vercel's build-rate reset;
2. verify Vapi readiness through the read-only readiness endpoint;
3. run one authenticated, genuinely Vapi-verifiable webhook event;
4. verify persisted CommunicationResult → Quote → recommendation in preview Neon;
5. prove canonical explicit-quantity case is `READY` and missing-quantity case is `BLOCKED_UNKNOWN`;
6. preserve the human approval boundary with no automatic purchase/payment/booking.

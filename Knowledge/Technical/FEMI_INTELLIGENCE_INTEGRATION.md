# Femi Intelligence Integration Contract

Status: WORKING CONTRACT — `femi/intelligence`
Owner: Femi
Last updated: 2026-10-01

This document describes how Xpen and Lara should consume the intelligence layer without depending on its internal ranking implementation.

It does **not** redefine Mission, Provider, Quote, CommunicationResult, MissionStep or Approval.

## Source-of-truth alignment

The implementation is intentionally aligned with:

- `Knowledge/Product/TRUST_MODEL.md`
- `Knowledge/Technical/MISSION_MODEL.md`
- `Knowledge/Technical/INTEGRATION_CONTRACTS.md`
- `Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md`
- `Knowledge/Decisions/ACTIVE_DECISIONS.md`

Relevant binding rules:

1. unknown values remain unknown;
2. hard constraints are applied before soft ranking;
3. only fully qualifying candidates can become a final recommendation;
4. transcripts/communication observations are evidence, not automatically Quotes;
5. durable Knowledge is separate from live operational data and memory;
6. consequential actions still require explicit human approval;
7. SABI remains the system of record.

## Public exports

Consume from:

```ts
import {
  evaluateCandidate,
  evaluateCandidates,
  rankQualifyingCandidates,
  rankEvidencePendingCandidates,
  recommend,
  retrieveKnowledge,
  assembleMissionContext
} from "@/lib/intelligence";
```

The exact import alias depends on the current application path configuration. The canonical source file is `lib/intelligence/index.ts`.

## Hard-constraint semantics

Every represented hard constraint resolves to one of:

```ts
type ConstraintStatus = "PASS" | "FAIL" | "UNKNOWN";
```

Meaning:

- `PASS` — factual data is represented and satisfies the constraint;
- `FAIL` — factual data is represented and violates the constraint;
- `UNKNOWN` — the required fact is not represented strongly enough to verify the constraint.

Candidate-level status uses the strict aggregation rule:

```text
any FAIL    → FAIL
else UNKNOWN → UNKNOWN
else         → PASS
```

`qualifies === true` only when candidate status is `PASS`.

`UNKNOWN` must never be silently converted into `PASS` to force a recommendation.

## Recommendation contract

`recommend(mission, providers, quotes)` returns a structured `RecommendationResult`.

Important fields:

```ts
type RecommendationDecisionStatus =
  | "READY"
  | "BLOCKED_UNKNOWN"
  | "NO_VALID_OPTIONS";
```

### READY

At least one candidate passed every represented hard constraint.

Consumers may use:

- `selected`
- `alternatives`
- `recommendationFactors`
- `exclusions`
- `uncertainties`
- `provenance`
- `approvalRequired`

A `READY` recommendation is still not authorization to transact.

### BLOCKED_UNKNOWN

No final recommendation is produced because at least one otherwise viable candidate still has an unknown hard fact.

Consumers should use:

- `pendingEvidence` — deterministic follow-up priority only;
- `requiredFacts` — factual gaps to resolve;
- `uncertainties` — candidate-specific unknown reasons;
- `provenance` — existing Quote evidence/source references.

`pendingEvidence[0]` is **not** a recommendation. It is simply the first candidate to investigate next.

### NO_VALID_OPTIONS

Every candidate fails at least one represented hard constraint.

Consumers should surface the exclusions and avoid requesting approval for an invalid option.

## Xpen integration boundary

Xpen/Mission orchestration should call `recommend()` after validated Quotes have been collected.

Expected flow:

```text
Mission
→ validated Provider + Quote records
→ recommend(...)
→ READY
   → persist/present selected recommendation
   → move to AWAITING_APPROVAL when appropriate

→ BLOCKED_UNKNOWN
   → stay in comparison/follow-up state
   → obtain required factual evidence
   → re-run recommendation

→ NO_VALID_OPTIONS
   → surface exclusions / expand search / escalate according to product flow
```

Do not advance a Mission to `AWAITING_APPROVAL` when decision status is `BLOCKED_UNKNOWN` or `NO_VALID_OPTIONS`.

## Lara integration boundary

Lara owns communication transport/runtime.

Communication remains separate from Quote truth:

```text
CommunicationResult / transcript
→ extraction
→ validation
→ required factual checks
→ Quote OR incomplete observation
→ recommend(...)
```

A no-answer, failed, initiated or incomplete communication must not fabricate Quote fields.

The intelligence layer consumes canonical Quote objects only after the communication/extraction boundary has done its validation.

## Context assembler boundary

`assembleMissionContext(...)` separates runtime context into explicit lanes:

```text
currentRequest
mission
durableKnowledge
operationalData
  ├─ providers
  └─ quotes
userMemory
communicationObservations
approvalState
provenance
```

Compatibility aliases (`knowledge`, `providers`, `quotes`) remain temporarily available for current consumers, but new integrations should prefer the explicit lanes.

Live price, live availability, delivery promises, Mission state and call outcomes must remain outside `durableKnowledge`.

## Knowledge retrieval

`retrieveKnowledge(...)` only returns `ACTIVE` durable entries by default.

Default procurement context retrieves the cross-cutting rules needed for:

- approval;
- procurement;
- truthfulness.

Other topics such as communication/trust may be explicitly requested when needed.

Each entry carries:

- stable Knowledge entry ID;
- stable `sourceId`;
- source file path;
- lifecycle;
- topic.

## Current quantity/capacity gap

The canonical Ankara Mission contains:

```text
quantity = 20
unit = yards
```

The canonical Quote schema currently contains:

```text
available: boolean
price?
deliveryFee?
total?
deliveryDate?
notes?
source
sourceReference?
```

It does **not** represent the exact quantity/capacity the provider confirmed.

Therefore:

```text
Quote.available === true
```

is not treated as independent proof that exactly `20 yards` are available.

For the current canonical Mission the quantity/capacity check is therefore `UNKNOWN` unless the shared contract is intentionally extended.

### Evaluation-proven contract proposal — team review required

The smallest useful shared-contract change appears to be explicit factual quantity evidence on Quote, for example:

```ts
quantity?: number;
unit?: string;
```

A final naming decision should be reviewed by Xpen/Femi/Lara because this is a shared domain contract.

No shared schema change has been made on this branch.

## Approval rule

A recommendation may be comparison-ready while still requiring human approval.

`approvalRequired` comes from Mission and is preserved by the intelligence layer; the intelligence layer does not invent or relax approval semantics.

## Ranking rule

Soft ranking occurs only after hard-constraint status is determined.

Current documented soft factors are:

1. factual total price;
2. provider verification flag;
3. represented reliability score;
4. represented rating;
5. deterministic IDs only as final tie-breakers.

No hidden field or model-generated score is used.

Evidence-pending candidates may be ordered using the same transparent factors **only for follow-up priority**. That ordering does not make them qualifying candidates.

## Provenance rule

Recommendation output preserves Quote provenance using:

- `quoteId`
- `providerId`
- `source`
- `sourceReference` when represented.

Knowledge context separately preserves Knowledge source IDs and paths.

## Integration rule of thumb

```text
missing fact → UNKNOWN
represented violation → FAIL
represented satisfied fact → PASS
PASS-only candidate → may be recommended
recommendation → may request approval
approval → still does not imply automatic purchase/payment
```

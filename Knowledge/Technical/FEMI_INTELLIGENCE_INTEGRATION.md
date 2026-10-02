# Femi Intelligence Integration Contract

Status: WORKING CONTRACT — `femi/intelligence`
Owner: Femi
Last updated: 2026-10-02

This document describes how Xpen and Lara should consume the intelligence layer without depending on its internal ranking implementation.

It does **not** redefine Mission, Provider, CommunicationResult, MissionStep or Approval. The coordinated Quote quantity extension is recorded by `ACTIVE_DECISIONS.md` D-028.

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
5. provider-confirmed quantity may be represented on Quote only when factual provider evidence exists;
6. durable Knowledge is separate from live operational data and memory;
7. consequential actions still require explicit human approval;
8. SABI remains the system of record.

## Public exports

Consume from:

```ts
import {
  extractQuoteFromCommunication,
  extractQuotesFromCommunications,
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

## Communication evidence → Quote extraction

The extraction boundary is implemented in:

```text
lib/intelligence/quote-extraction.ts
```

Primary function:

```ts
extractQuoteFromCommunication(communication, {
  mission?,
  quoteId?,
  createdAt?,
  confirmedQuantity?: {
    quantity: number;
    unit?: string;
  }
})
```

`confirmedQuantity` must only be supplied when the caller holds factual provider evidence for that amount/unit. It must never be populated by copying `Mission.quantity` merely because the Mission requested that amount.

Batch extraction intentionally does not accept one shared `confirmedQuantity` value because quantity evidence is communication/provider-specific.

### Minimum evidence for Quote creation

A canonical Quote is created only when:

1. `CommunicationResult.status === "COMPLETED"`; and
2. `CommunicationResult.observation.available` is explicitly represented.

SABI does not parse prices, delivery promises or availability out of `summary`. Transcript normalization must first produce structured factual evidence.

```text
NO_ANSWER / FAILED / INITIATED / IN_PROGRESS
→ NOT_QUOTABLE

COMPLETED + no structured observation
→ INCOMPLETE

COMPLETED + observation but no explicit availability
→ INCOMPLETE

COMPLETED + explicit availability
→ QUOTE_CREATED
```

An explicit provider response of `available: false` is decision-useful and may become a canonical unavailable Quote without inventing price, fee, total, delivery date or capacity.

### Missing facts remain missing

For an available option, extraction reports missing factual fields separately rather than guessing them:

- `PRICE_UNKNOWN`
- `DELIVERY_FEE_UNKNOWN`
- `TOTAL_UNKNOWN`
- `DELIVERY_DATE_UNKNOWN` when the Mission has a deadline
- `QUANTITY_CAPACITY_UNREPRESENTED` when the Mission has a hard quantity but factual provider-confirmed quantity evidence was not supplied, or when a required unit is still missing

These gaps do not necessarily block Quote creation; downstream hard-constraint evaluation decides whether the Quote can support a recommendation.

### Total normalization

`total` is derived only when both factual components are represented:

```text
price + deliveryFee → total
```

If `deliveryFee` is missing, it is **not** assumed to be zero and `total` remains unknown. Explicit free delivery remains representable as `deliveryFee: 0`.

### Quantity/capacity normalization

D-028 extends canonical Quote with optional:

```ts
quantity?: number;
unit?: string;
```

These fields mean **provider-confirmed/quoted quantity evidence**.

Rules:

```text
Mission has no quantity constraint
→ quantity check PASS

Mission requires quantity, Quote.quantity missing
→ UNKNOWN

Mission requires a unit, Quote.quantity exists but Quote.unit missing
→ UNKNOWN

Quote quantity below required amount
→ FAIL / QUANTITY_CAPACITY_INSUFFICIENT

Quote unit incompatible with Mission unit
→ FAIL / QUANTITY_UNIT_MISMATCH

Provider-confirmed quantity >= required amount with compatible unit
→ PASS
```

Simple singular/plural unit forms such as `yard` / `yards` compare as compatible. More complex unit conversion is intentionally not invented.

### Provenance

Every created Quote points back to the SABI communication record:

```text
sourceReference = communication:<communicationId>
```

The extraction result separately preserves communication ID, mission ID, provider ID, channel, communication status, external transport ID when present, and occurrence timestamp.

## Hard-constraint semantics

Every represented hard constraint resolves to one of:

```ts
type ConstraintStatus = "PASS" | "FAIL" | "UNKNOWN";
```

Candidate-level status uses the strict aggregation rule:

```text
any FAIL     → FAIL
else UNKNOWN → UNKNOWN
else         → PASS
```

`qualifies === true` only when candidate status is `PASS`. `UNKNOWN` is never silently converted into `PASS`.

## Recommendation contract

`recommend(mission, providers, quotes)` returns:

```ts
type RecommendationDecisionStatus =
  | "READY"
  | "BLOCKED_UNKNOWN"
  | "NO_VALID_OPTIONS";
```

### READY

At least one candidate passed every represented hard constraint. Consumers may use `selected`, `alternatives`, `recommendationFactors`, `exclusions`, `uncertainties`, `provenance`, and `approvalRequired`.

A `READY` recommendation is still not authorization to transact.

### BLOCKED_UNKNOWN

No final recommendation is produced because otherwise viable candidates still have an unknown hard fact. `pendingEvidence[0]` is follow-up priority, not a recommendation.

### NO_VALID_OPTIONS

Every candidate fails at least one represented hard constraint. Consumers should surface exclusions and avoid requesting approval for an invalid option.

## Xpen integration boundary

Expected flow:

```text
Mission
→ CommunicationResult(s)
→ factual transcript/observation normalization
→ extractQuoteFromCommunication(...)
→ canonical Quote(s)
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

Lara owns communication transport/runtime, webhook authenticity, correlation and lifecycle normalization. Communication remains separate from Quote truth.

The reviewed seam is:

```text
verified transport event / transcript
→ CommunicationResult lifecycle record
→ normalizeCommunicationTranscript(...)
→ CommunicationResult.observation + field-level transcript evidence
→ provider-confirmed quantity evidence when explicitly supported by transcript
→ extractQuoteFromCommunication(..., { confirmedQuantity })
→ canonical Quote
→ recommend(...)
```

The transcript normalizer still exposes its quantity sidecar under the historical name `unrepresentedQuantityEvidence`. That means the quantity is not stored in `CommunicationResult.observation`; after D-028, callers may explicitly promote that factual sidecar into `Quote.quantity` / `Quote.unit` through `confirmedQuantity`.

Lara should not set missing values merely to make a Quote complete. In particular:

- no answer does not mean `available: false`;
- missing delivery fee does not mean `deliveryFee: 0`;
- a transcript summary containing a number is not sufficient unless structured evidence identifies the factual field;
- transport `UNAVAILABLE` does not automatically mean the requested product/service is unavailable;
- `Mission.quantity` is never copied into Quote without provider evidence.

## Canonical Ankara behavior

Mission:

```text
20 yards black Ankara
Yaba
tomorrow
budget ≤ ₦70,000
```

With explicit provider confirmation:

```text
Provider confirms 20 yards
price ₦60,000
delivery ₦3,000
delivery tomorrow
→ Quote.quantity = 20
→ Quote.unit = yards
→ Quote.total = ₦63,000
→ quantity PASS
→ budget PASS
→ deadline PASS
→ recommendation READY
```

Without provider-confirmed quantity:

```text
available = true
quantity absent
→ quantity UNKNOWN
→ otherwise viable candidate remains BLOCKED_UNKNOWN unless another PASS candidate exists
```

This preserves the original unknown-is-unknown rule while allowing explicit evidence to satisfy the hard quantity constraint.

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

Live price, live availability, delivery promises, provider-confirmed quantity, Mission state and call outcomes remain outside `durableKnowledge`.

## Knowledge retrieval

`retrieveKnowledge(...)` only returns `ACTIVE` durable entries by default. Default procurement context retrieves approval, procurement and truthfulness guidance. Each entry carries a stable Knowledge entry ID, source ID/path, lifecycle and topic.

## Approval rule

`approvalRequired` comes from Mission and is preserved by the intelligence layer. A `READY` recommendation still requires explicit human approval whenever the Mission says approval is required.

## Ranking rule

Soft ranking occurs only after hard-constraint status is determined. Current documented factors are factual total price, provider verification, represented reliability score, represented rating, then deterministic IDs as final tie-breakers.

Evidence-pending candidates may be ordered using the same factors only for follow-up priority; that does not make them qualifying candidates.

## Provenance rule

Recommendation output preserves Quote provenance through `quoteId`, `providerId`, `source`, and `sourceReference` when represented. Knowledge context separately preserves Knowledge source IDs and paths.

## Integration rule of thumb

```text
transport/transcript
→ structured provider evidence
→ evidence-safe Quote extraction
→ hard constraints
→ ranking only among PASS candidates
→ recommendation
→ human approval
```

At every boundary:

```text
missing fact → UNKNOWN
represented violation → FAIL
represented satisfied fact → PASS
PASS-only candidate → may be recommended
recommendation → may request approval
approval → still does not imply automatic purchase/payment
```

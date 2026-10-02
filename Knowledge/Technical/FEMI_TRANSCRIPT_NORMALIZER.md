# Femi Transcript → Observation Normalizer

Status: WORKING CONTRACT — `femi/intelligence`
Owner: Femi
Last updated: 2026-10-02

## Purpose

This module is the conservative boundary between Lara's verified communication/transcript evidence and the canonical `CommunicationResult.observation` consumed by Quote extraction.

It does not own telephony, webhook authentication, call correlation, retry handling or Mission persistence.

## Runtime seam

```text
verified Vapi/Kros event
→ Lara extracts raw transcript + canonical CommunicationResult lifecycle record
→ normalizeCommunicationTranscript(...)
→ structured CommunicationResult.observation when evidence is safe
→ provider-confirmed quantity sidecar when explicitly supported
→ extractQuoteFromCommunication(...)
→ recommend(...)
```

## Public API

Consume from `lib/intelligence`:

```ts
parseRoleLabeledTranscript(...)
normalizeProviderTranscript(...)
normalizeCommunicationTranscript(...)
```

## Truthfulness rules

1. Only provider-authored turns can produce commercial facts.
2. Recognized SABI/AI turns are context only; SABI's own questions never become provider facts.
3. Unlabelled transcript text is not extracted because speaker identity is unknown.
4. `AI:` / `Assistant:` / `SABI:` are treated as SABI turns.
5. `User:` / `Customer:` / `Provider:` / `Vendor:` / `Seller:` are treated as provider turns for the outbound provider-call context.
6. A simple provider `yes` or `no` is usable only when the immediately preceding SABI turn establishes the factual question being confirmed.
7. Conflicting values remain unknown. The normalizer emits an ambiguity instead of choosing one.
8. Missing price, delivery fee, delivery date or availability remain absent.
9. Missing delivery fee is never converted to zero.
10. The normalizer never computes Quote total; Quote extraction remains responsible for factual total derivation.
11. Transcript data is applied only when `CommunicationResult.status === "COMPLETED"`.
12. Existing structured `CommunicationResult.observation` is never overwritten by transcript parsing.
13. Mission quantity is never copied into Quote unless provider transcript evidence explicitly confirms the amount.

## Current extracted canonical observation fields

The normalizer populates the existing `CommunicationObservation` contract only:

```ts
{
  available?: boolean;
  price?: number;
  deliveryFee?: number;
  deliveryDate?: string;
}
```

Exact provider-confirmed quantity is intentionally kept outside `CommunicationResult.observation` because quantity is Quote evidence rather than a transport lifecycle field.

## Field-level evidence

Every extracted value carries sidecar evidence containing:

- field;
- value;
- provider turn index;
- exact provider text;
- relevant SABI context text when needed;
- extraction rule.

Extraction rules are deliberately narrow:

```text
EXPLICIT_PROVIDER_STATEMENT
AFFIRMATIVE_PROVIDER_CONFIRMATION
CONTEXTUAL_NUMERIC_ANSWER
```

This sidecar makes the transformation explainable and testable without putting raw transcript text into canonical Quote fields.

## Quantity/capacity evidence

The normalizer can detect factual confirmation of the Mission's requested quantity when the provider explicitly confirms the amount or answers yes to an exact quantity-availability question.

For example:

```text
SABI: Do you have 20 yards of black Ankara available?
Provider: Yes, we have it.
```

The normalizer preserves this as `unrepresentedQuantityEvidence` sidecar evidence:

```ts
{
  quantity: 20,
  unit: "yards",
  evidence: [...]
}
```

The field name is historical: the quantity is still not represented inside `CommunicationResult.observation`. Under D-028, however, Quote now has optional `quantity` / `unit`, so a caller may promote this sidecar into Quote extraction only when the transcript evidence is factual.

```ts
const quantityEvidence =
  normalized.normalization.unrepresentedQuantityEvidence;

const extraction = extractQuoteFromCommunication(
  normalized.communication,
  {
    mission,
    confirmedQuantity: quantityEvidence
      ? {
          quantity: quantityEvidence.quantity,
          unit: quantityEvidence.unit
        }
      : undefined
  }
);
```

This keeps the trust boundary explicit:

```text
Mission asks for 20 yards
+ provider explicitly confirms 20 yards
→ Quote.quantity = 20 / Quote.unit = yards

Mission asks for 20 yards
+ provider merely says generic "available"
→ Quote.quantity absent
→ quantity constraint UNKNOWN
```

## Lara integration rule

Lara's verified Vapi/Kros adapter exposes transcript evidence but intentionally does not infer Quote fields. That remains correct.

At the integration seam, the consumer should do conceptually:

```ts
const communication = await adapter.normalizeEvent(payload);
const transcript = verifiedTranscriptFromProviderEvent(payload);

const normalized = normalizeCommunicationTranscript(
  communication,
  transcript,
  { mission }
);

const quantityEvidence =
  normalized.normalization.unrepresentedQuantityEvidence;

const quoteEvidence = extractQuoteFromCommunication(
  normalized.communication,
  {
    mission,
    confirmedQuantity: quantityEvidence
      ? {
          quantity: quantityEvidence.quantity,
          unit: quantityEvidence.unit
        }
      : undefined
  }
);
```

`verifiedTranscriptFromProviderEvent(...)` remains Lara/transport ownership because transcript location and webhook authenticity are adapter concerns.

## Important non-goals

The deterministic MVP parser is not a general natural-language-understanding system.

It is intentionally optimized for the bounded demo conversation where SABI asks explicit questions about:

- requested availability / quantity;
- product price;
- delivery date;
- delivery fee.

For arbitrary natural conversations, multilingual semantic extraction, negotiation, corrections, complex units or unit conversion, a future structured extraction model can sit behind the same output contract. It must preserve the same evidence/provenance and unknown-on-ambiguity rules.

## Failure behavior

```text
unlabelled transcript       → no observation
unknown speaker content     → ignored + ambiguity
non-completed communication → transcript not applied
existing observation        → preserved
conflicting prices          → price omitted + ambiguity
conflicting availability    → availability omitted + ambiguity
missing quantity evidence   → Quote quantity absent / constraint UNKNOWN
no provider evidence        → no observation
```

## Downstream rule

Transcript normalization creates evidence, not authority.

```text
Transcript
→ Observation + field-level evidence
→ Quote validation
→ Hard constraints
→ Recommendation
→ Human approval
```

No stage skips the next validation boundary.

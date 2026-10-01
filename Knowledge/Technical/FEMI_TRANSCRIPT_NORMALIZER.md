# Femi Transcript → Observation Normalizer

Status: WORKING CONTRACT — `femi/intelligence`
Owner: Femi
Last updated: 2026-10-01

## Purpose

This module is the conservative boundary between Lara's verified communication/transcript evidence and the canonical `CommunicationResult.observation` consumed by Quote extraction.

It does not own telephony, webhook authentication, call correlation, retry handling, Mission persistence, or shared schema changes.

## Runtime seam

```text
verified Vapi/Kros event
→ Lara extracts raw transcript + canonical CommunicationResult lifecycle record
→ normalizeCommunicationTranscript(...)
→ structured CommunicationResult.observation when evidence is safe
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

## Current extracted canonical fields

The normalizer can populate only fields already represented by the shared `CommunicationObservation` contract:

```ts
{
  available?: boolean;
  price?: number;
  deliveryFee?: number;
  deliveryDate?: string;
}
```

It intentionally does not invent additional shared fields.

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

## Quantity/capacity finding

The normalizer can detect factual confirmation of the Mission's requested quantity when the provider explicitly confirms the quantity or answers yes to an exact quantity-availability question.

For example:

```text
SABI: Do you have 20 yards of black Ankara available?
Provider: Yes, we have it.
```

The normalizer preserves this as `unrepresentedQuantityEvidence` sidecar evidence.

It does **not** place the value in `CommunicationResult.observation` or `Quote`, because neither shared contract currently has a reviewed exact quantity/capacity field.

Therefore the existing recommendation layer still treats exact capacity as `UNKNOWN` under the canonical contracts. This avoids solving the shared-contract gap through an undocumented side channel.

## Lara integration rule

Lara's verified Vapi/Kros adapter currently exposes transcript evidence but intentionally does not infer Quote fields. That remains correct.

At the integration seam, the consumer should do conceptually:

```ts
const communication = await adapter.normalizeEvent(payload);
const transcript = verifiedTranscriptFromProviderEvent(payload);

const normalized = normalizeCommunicationTranscript(
  communication,
  transcript,
  { mission }
);

const quoteEvidence = extractQuoteFromCommunication(
  normalized.communication,
  { mission }
);
```

`verifiedTranscriptFromProviderEvent(...)` remains Lara/transport ownership because transcript location and webhook authenticity are adapter concerns.

## Important non-goals

The deterministic MVP parser is not a general natural-language-understanding system.

It is intentionally optimized for the bounded demo conversation where SABI asks explicit questions about:

- requested availability;
- product price;
- delivery date;
- delivery fee.

For arbitrary natural conversations, multilingual semantic extraction, negotiation, corrections, or complex units, a future structured extraction model can sit behind the same output contract. It must preserve the same evidence/provenance and unknown-on-ambiguity rules.

## Failure behavior

```text
unlabelled transcript       → no observation
unknown speaker content     → ignored + ambiguity
non-completed communication → transcript not applied
existing observation        → preserved
conflicting prices          → price omitted + ambiguity
conflicting availability    → availability omitted + ambiguity
no provider evidence        → no observation
```

## Downstream rule

Transcript normalization creates evidence, not authority.

```text
Transcript
→ Observation
→ Quote validation
→ Hard constraints
→ Recommendation
→ Human approval
```

No stage skips the next validation boundary.

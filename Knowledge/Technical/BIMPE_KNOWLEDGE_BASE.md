# SABI — Bimpe Knowledge Base Pack

Status: READY FOR CONFIGURATION

This document is the curated durable Knowledge pack for the SABI Bimpe agent. It condenses active SABI policy without including current prices, availability, call outcomes, Quotes, or other mission-specific operational facts.

## 1. Human approval policy

Consequential actions require explicit human approval.

SABI may understand requests, search, filter, communicate, collect information, compare, recommend, and prepare a next action. It may not purchase, book, send money, release escrow, exceed a hard budget, accept a material constraint change, or otherwise commit the user without explicit approval.

The hackathon MVP stops at human approval and does not execute production payment or escrow.

Source of truth: `Knowledge/Product/TRUST_MODEL.md`, `Knowledge/Product/MVP_SCOPE.md`.

Keywords: approval, human, purchase, payment, book, budget, escrow, control.

## 2. Procurement mission process

A supported procurement mission follows:

```text
natural-language request
→ structured Mission
→ provider discovery
→ provider contact
→ factual provider response
→ validated Quote
→ comparison
→ recommendation
→ human approval
```

The agent should not skip observable stages or claim stages completed when the backend has not reported them.

Source of truth: `Knowledge/Product/MVP_SCOPE.md`, `Knowledge/Technical/MISSION_ORCHESTRATION_RUNTIME.md`.

Keywords: procurement, mission, provider, quote, recommendation, workflow.

## 3. Truthfulness and unknown values

Unknown values remain unknown.

A failed tool call is not success. An initiated call is not a completed call. A provider who did not answer has not supplied a Quote. A missing fee is not zero. A transcript is evidence, not automatically a Quote.

When evidence is incomplete, preserve the incomplete observation or waiting state rather than inventing a complete result.

Source of truth: `Knowledge/Product/TRUST_MODEL.md`, `Knowledge/Technical/INTEGRATION_CONTRACTS.md`.

Keywords: truth, unknown, evidence, failure, transcript, no-answer, quote.

## 4. Quote provenance

Provider facts recorded as a Quote must remain traceable to their source.

A Quote can contain availability, price, delivery fee, total, delivery date, notes, source, and source reference. Optional values remain absent when not known. Agent-recorded Quotes require a source reference in the current SABI implementation.

No-answer, busy, unavailable, or failed communication must not generate fabricated totals or delivery promises.

Source of truth: canonical `Quote` schema and `Knowledge/Technical/INTEGRATION_CONTRACTS.md`.

Keywords: quote, provenance, source, price, delivery, availability.

## 5. Hard-constraint comparison

SABI applies hard constraints before ranking.

Represented hard constraints include:

- requested availability;
- hard budget ceiling;
- required deadline/delivery timing;
- provider/category compatibility;
- provider active status;
- enough factual Quote data to evaluate the constraint.

Only qualifying options are ranked. Excluded options retain factual rejection reasons.

Source of truth: Femi intelligence module under `lib/intelligence/`.

Keywords: compare, budget, deadline, ranking, exclusion, qualifying.

## 6. Recommendation explanation

A recommendation should explain the represented factors that support it. Current deterministic ranking can use represented total price, verification, reliability, rating, and stable tie-breaking after hard constraints are satisfied.

Do not imply that seeded/demo verification is production verification. Do not claim an option is superior on a factor that was not represented in the supplied data.

Source of truth: `Knowledge/Product/TRUST_MODEL.md`, `lib/intelligence/ranking.ts`, `lib/intelligence/recommendation.ts`.

Keywords: recommendation, explanation, verification, reliability, rating, price.

## 7. Provider trust

Trust is a system property, not a single badge.

Potential provider trust signals include verified contact, identity/business verification, location evidence, registration evidence where relevant, completed work, ratings/reviews, cancellations, disputes, response rate, fulfilment reliability, and repeat customers.

For the hackathon, some trust signals are seeded/demo data and must remain labelled as such.

Source of truth: `Knowledge/Product/TRUST_MODEL.md`.

Keywords: trust, provider, verified, reputation, reliability.

## 8. Communication semantics

Provider communication is normalized into SABI `CommunicationResult` state.

Canonical communication statuses include:

```text
INITIATED
IN_PROGRESS
COMPLETED
NO_ANSWER
UNAVAILABLE
FAILED
```

`INITIATED` means contact initiation was accepted. It does not prove ringing, answer, conversation, completion, or Quote creation.

Partner-specific statuses belong behind communication adapters. Mission logic should consume only normalized SABI states.

Source of truth: canonical `CommunicationResult` schema and `Knowledge/Technical/INTEGRATION_CONTRACTS.md`.

Keywords: communication, call, initiated, completed, no-answer, failure.

## 9. Simulation vs live operation

Simulation evidence must be clearly labelled and never represented as a real provider interaction.

In simulation mode SABI may use explicit demo fixtures. In live mode SABI must not silently fall back to demo providers or demo Quotes. When live provider discovery, communication, or factual evidence is missing, SABI should return a waiting/unavailable state.

Source of truth: `Knowledge/Technical/MISSION_ORCHESTRATION_RUNTIME.md`.

Keywords: simulation, live, mock, demo, provider, evidence.

## 10. Bounded tools

The agent receives narrow HTTP tools rather than unrestricted database/backend access.

Current golden-path tool surface:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
orchestrateMission
requestApproval
```

Bimpe coordinates these tools but SABI remains the system of record for Mission, Provider, CommunicationResult, Quote, recommendation, and Approval.

Source of truth: `lib/integrations/bimpe/tool-manifest.ts`, `Knowledge/Technical/INTEGRATION_CONTRACTS.md`.

Keywords: tools, Bimpe, API, bounded, system of record.

## 11. Operational data boundary

The following are operational data, not durable Knowledge:

- current Mission status;
- current provider availability;
- current price;
- current delivery promise;
- current communication outcome;
- current Quote;
- current recommendation/approval state.

Always read these from SABI persisted state or verified tool results.

Source of truth: SABI LLM/Knowledge architecture.

Keywords: operational, current, mission, price, availability, status.

## 12. Hackathon MVP boundary

The MVP proves real-world coordination while preserving human control. It does not include production payments, real escrow, a full marketplace, a complete KYC platform, a delivery network, a broad autonomous purchasing system, or advanced fraud/ML infrastructure.

Once the primary mission flow is repeatable, reliability and demo clarity take priority over optional features.

Source of truth: `Knowledge/Product/MVP_SCOPE.md`.

Keywords: MVP, scope, hackathon, freeze, out-of-scope.

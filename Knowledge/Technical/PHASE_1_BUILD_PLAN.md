# Phase 1 — MVP Skeleton Build Plan

Status: FOUNDATION COMPLETE / CURRENT INTEGRATION HANDOFF
Last updated: 2026-09-30
Owner: Xpen

## Completed foundation

The original Phase 1 skeleton goal has been achieved on `main`.

Completed:

- Next.js + TypeScript app
- shared Zod schemas
- Mission/Provider/Quote/MissionStep/Approval/CommunicationResult
- deterministic Mission state machine
- provider-neutral communication adapter
- mock communication adapter
- Home + Mission Control
- mock Mission engine
- mock Quote/recommendation display
- human-approval UI
- focused tests
- GitHub CI

The team is no longer waiting for the skeleton.

## Current integration objective

Replace temporary/mock-owned pieces with teammate modules and one verified partner path without changing shared domain contracts.

Target:

```text
request
→ validated Mission
→ provider discovery
→ bounded communication action
→ CommunicationResult
→ validated Quote
→ hard filtering/ranking
→ recommendation
→ Mission Control
→ human approval
```

## Current workstreams

### Xpen

- integrate Femi + Lara modules
- keep Mission Control truthful
- configure BimpeAI workflow/Knowledge/bounded SABI API tools
- preserve Approval boundary
- own final demo integration/freeze

### Femi

- canonical demo data
- hard constraints
- ranking
- Quote intelligence
- Knowledge/retrieval/context assembly
- Bimpe KB content mapping
- evaluation

### Lara

- tool layer
- communication adapter/event normalization
- Kros webhook/idempotency
- real Kros transport
- Vapi first runtime
- optional Spitch/LiveKit multilingual path
- optional Temlio fallback only with verified contract

## Verified partner order

1. integrated mock loop
2. Bimpe agent/Knowledge/tool seam
3. Kros account/KYC/key/number + confirmed live route
4. one consented Kros test call + verified webhook/transcript
5. Vapi first voice runtime
6. close Quote/comparison/approval loop
7. optional Spitch/LiveKit language enhancement
8. optional Temlio SMS fallback

## Build gates

### Gate 1 — integrated mock loop

Femi and Lara modules replace the temporary Xpen fixtures without breaking Mission Control.

### Gate 2 — Bimpe tool seam

Bimpe agent uses curated knowledge and can invoke at least one bounded SABI API tool while SABI remains system of record.

Use REST/native server-side `fetch` under current Node 20 unless the team deliberately upgrades runtime/CI for the Node-24+ Bimpe SDK.

### Gate 3 — Kros transport

- live base/path confirmed
- endpoint attached to number
- one consented call
- external call ID/lifecycle observed
- signed webhook/event verified
- event deduplicated/correlated
- transcript/result available
- `CommunicationResult` produced

### Gate 4 — real Quote loop

```text
real provider result
→ factual extraction
→ Quote validation
→ Femi comparison
→ Mission Control
→ human approval
```

No transcript-only or no-answer event may fabricate a Quote.

### Gate 5 — demo freeze

Freeze when the golden path is repeatable. Optional integrations may not destabilize it.

## Out of scope remains unchanged

- real payments
- escrow
- full marketplace
- full KYC platform
- delivery network
- complex auth/admin
- broad autonomous purchasing
- unrelated social/product features

## Source rule

For partner implementation, follow:

1. current official docs
2. live API Explorer/dashboard/account behavior
3. ACTIVE SABI partner knowledge

If official docs conflict, centralize/configure the uncertain behavior and verify it with a minimal safe request rather than guessing.

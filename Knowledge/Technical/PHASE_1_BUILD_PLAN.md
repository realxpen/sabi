# Phase 1 — MVP Skeleton Build Plan

Status: ACTIVE PLAN
Owner: Xpen
Team review required before implementation

## Goal

Create the smallest reliable application skeleton that lets all three team members work in parallel without inventing different architectures.

Phase 1 does not integrate real partner APIs yet.

## Phase 1 checkpoint

At the end of this phase, the repository should contain:

- working Next.js + TypeScript app
- shared domain schemas
- seeded demo provider data
- mission creation/read flow
- deterministic mission state transitions
- mock provider search
- mock communication adapter
- mock quote collection
- comparison logic placeholder/interface
- Mission Control UI
- approval screen
- clear integration adapter interfaces
- tests for core schemas/state transitions
- no real payments
- no exposed secrets

## Recommended structure

~~~
app/
  page.tsx
  mission/[id]/page.tsx
  api/
    missions/
    providers/
    approvals/
    webhooks/

components/
  MissionInput.tsx
  MissionHeader.tsx
  MissionTimeline.tsx
  MissionStep.tsx
  ProviderCard.tsx
  QuoteCard.tsx
  RecommendationCard.tsx
  ApprovalCard.tsx
  StatusBadge.tsx

lib/
  agent/
  tools/
  integrations/
  matching/
  mission/
  knowledge/
  db/
  schemas/

data/
  demo-providers.ts

tests/
~~~

Preserve architectural intent rather than forcing paths that fight the framework.

## Build sequence

### 1A — Foundation scaffold

Owner: Xpen

Create the app, lint/typecheck/test commands, project structure, shared schema files, and basic home/mission routes.

Gate: app runs locally and shared domain types compile.

### 1B — Domain contracts

Owner: Xpen, reviewed by Femi and Lara.

Implement the ACTIVE contracts from MISSION_MODEL.md and INTEGRATION_CONTRACTS.md:

- Mission
- Provider
- Quote
- MissionStep
- Approval
- CommunicationResult
- communication adapter interface

Gate: Femi and Lara can build against stable interfaces.

### 1C — Mock mission engine

Owner: Xpen.

Create a local happy path:

~~~
request
→ mission
→ mock providers
→ mock communication result
→ normalized quotes
→ comparison
→ awaiting approval
~~~

Gate: canonical Ankara mission reaches AWAITING_APPROVAL with mock data.

### 1D — Mission Control UI

Owner: Xpen.

Build intent input, extracted mission summary, real mission-step timeline, result cards, recommendation, and approval UI.

The UI must render stored system state rather than fake completed actions.

## Parallel start point

Femi and Lara do not wait until Phase 1 is finished.

They begin implementation immediately after 1B — Domain contracts is merged.

At that point:

- Femi starts Intelligence/Data/Knowledge work.
- Lara starts Agent Tools/Communication work.
- Xpen continues the mission engine, UI, and integration.

## Branches

Suggested branches:

- xpen/mvp-shell
- femi/intelligence
- lara/agent-tools

Rules:

- pull latest main before integration
- keep changes small
- do not silently modify shared contracts
- discuss shared-contract changes first
- record consequential decisions in Knowledge/Decisions
- do not let a coding agent rewrite unrelated areas

## Phase 1 acceptance tests

1. App boots.
2. Canonical mission can be submitted.
3. Request becomes a validated Mission.
4. Provider seed data can be searched.
5. Mock communication produces a structured observation.
6. Observation normalizes into Quote.
7. Hard constraints exclude invalid quotes.
8. A recommendation can be produced.
9. Mission reaches AWAITING_APPROVAL.
10. Approval causes no real transaction.
11. At least one failure path is truthful.
12. No secrets exist in client code or the repository.

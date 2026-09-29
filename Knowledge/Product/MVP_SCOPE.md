# SABI Hackathon MVP Scope

Status: ACTIVE

## MVP purpose

Prove one thing exceptionally well:

> An AI agent can take a real-world informal-commerce request, discover suitable providers, contact real people, collect structured responses, compare valid options, and return an actionable recommendation while preserving human control.

## Canonical demo

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Required end-to-end flow

```text
Natural-language request
→ structured mission
→ provider search
→ candidate selection
→ provider contact
→ provider response
→ structured quote
→ quote comparison
→ recommendation
→ human approval
```

## Must have

- natural-language mission input
- extraction of item/service, quantity, budget, location, deadline
- seeded provider directory
- provider filtering/matching
- at least one real communication path during the demo if partner access permits
- structured quote normalization
- mission timeline/status
- comparison of multiple responses
- explainable recommendation
- approval screen
- truthful failure states
- a minimal knowledge/retrieval layer for relevant policy/context
- logs sufficient to understand what happened in the demo

## Nice to have

Only after the required path is stable:

- SMS fallback
- African-language voice interaction
- multiple provider calls
- user preference retrieval
- richer recommendation explanation
- provider reputation weighting
- live realtime updates rather than polling
- secondary service mission

## Explicitly out of scope

- production payments
- real escrow
- complete KYC platform
- full marketplace
- full vendor application/onboarding
- delivery network
- complex identity/auth system
- social feed
- advanced admin dashboard
- mobile app
- large recommendation model
- broad autonomous purchasing
- dozens of use cases
- production-grade fraud detection

## Success criteria

The MVP succeeds when a judge can observe this sequence without explanation filling in missing product behavior:

1. User enters the canonical request.
2. SABI displays the extracted mission.
3. SABI finds relevant providers.
4. SABI contacts at least one provider or executes the verified demo communication flow.
5. Provider response becomes structured data.
6. SABI compares at least two viable quotes or a realistic demo set containing at least one real collected response.
7. SABI recommends a qualifying option and explains why.
8. SABI stops and asks for approval.

## Freeze rule

Once the required flow works reliably, feature development stops. Remaining time goes to reliability, recovery behavior, visual clarity, and presentation.

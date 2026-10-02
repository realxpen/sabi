# Vapi Runtime Verification

This note records the non-production runtime verification path for the Lara → Femi → Xpen integration branch.

## Current verification target

Branch: `integration/vapi-intelligence-persistence`

Goal:

```text
verified Vapi webhook fixture
→ transcript normalization
→ CommunicationResult.observation
→ Quote extraction
→ hard constraints + deterministic recommendation
→ Mission snapshot persistence
```

## Environment requirements

- Vercel project `sabi`
- Neon project `Sabi` (`silent-meadow-13882415`)
- Neon-managed Vercel integration
- fresh `vercel-dev` branch managed by the integration
- preview deployments receive `DATABASE_URL`
- no real provider call, approval, booking, purchase, or payment during verification

## Runtime checks

1. Fresh preview reports database configuration present and reachable.
2. Required persistence tables are visible to the preview connection.
3. A synthetic, authenticated Vapi-shaped completion event can persist communication evidence.
4. Explicit provider confirmation of 20 yards can produce a Quote carrying factual quantity/unit evidence.
5. The same event can yield a `READY` recommendation when all hard constraints pass.
6. Missing quantity confirmation must remain `BLOCKED_UNKNOWN`.
7. No-answer must not create a Quote.
8. Persistence failure must leave the webhook event retryable.

This document intentionally contains no secrets or live provider identifiers.

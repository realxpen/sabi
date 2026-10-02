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

## Verified preview state — 2026-10-02

The Neon-managed Vercel integration is connected to the existing Sabi Neon project.

A fresh Vercel preview for this branch created the isolated Neon branch:

`preview/integration/vapi-intelligence-persistence`

Runtime status on the deployed preview confirms:

```text
databaseConfigured: true
databaseReachable: true
requiredTablesReady: true
```

The isolated preview database contains:

- `approvals`
- `communication_event_claims`
- `mission_snapshots`
- `quotes`

The preview `quotes` schema includes nullable provider-evidence fields `quantity` and `unit`, plus the positive-when-present quantity constraint.

The remaining runtime gate is Vapi configuration in the Preview environment. The preview currently keeps `SABI_COMMUNICATION_MODE=mock` and has no configured Vapi API/webhook credentials, so `/api/webhooks/vapi` correctly remains unavailable for a live/authenticated provider event.

## Runtime checks

1. Fresh preview reports database configuration present and reachable. ✅
2. Required persistence tables are visible to the preview connection. ✅
3. Preview `quotes` schema carries `quantity` / `unit`. ✅
4. Vercel check succeeds on the exact preview SHA. ✅
5. A synthetic, authenticated Vapi-shaped completion event can persist communication evidence. Pending Vapi Preview credentials.
6. Explicit provider confirmation of 20 yards can produce a Quote carrying factual quantity/unit evidence. Pending HTTP runtime proof; covered by automated integration tests.
7. The same event can yield a `READY` recommendation when all hard constraints pass. Pending HTTP runtime proof; covered by automated integration tests.
8. Missing quantity confirmation must remain `BLOCKED_UNKNOWN`. Covered by automated integration tests.
9. No-answer must not create a Quote. Covered by automated integration tests.
10. Persistence failure must leave the webhook event retryable. Covered by automated integration tests.

This document intentionally contains no secrets or live provider identifiers.

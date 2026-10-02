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

Vapi Preview environment variables were entered in Vercel after the previous preview was built. The previously deployed preview correctly picked up `SABI_COMMUNICATION_MODE=vapi-kros`, but its Vapi credential flags remained false because Vercel environment-variable changes only affect subsequent deployments. This documentation commit intentionally triggers a fresh preview so the new deployment can load the configured Preview variables without changing runtime code.

## Runtime checks

1. Fresh preview reports database configuration present and reachable. ✅
2. Required persistence tables are visible to the preview connection. ✅
3. Preview `quotes` schema carries `quantity` / `unit`. ✅
4. Vercel check succeeds on the database-backed preview SHA. ✅
5. Fresh post-configuration preview reports the Vapi API, assistant, SIP, and webhook-auth settings as configured. Pending this redeploy.
6. A synthetic, authenticated Vapi-shaped completion event can persist communication evidence. Pending Vapi runtime verification.
7. Explicit provider confirmation of 20 yards can produce a Quote carrying factual quantity/unit evidence. Pending HTTP runtime proof; covered by automated integration tests.
8. The same event can yield a `READY` recommendation when all hard constraints pass. Pending HTTP runtime proof; covered by automated integration tests.
9. Missing quantity confirmation must remain `BLOCKED_UNKNOWN`. Covered by automated integration tests.
10. No-answer must not create a Quote. Covered by automated integration tests.
11. Persistence failure must leave the webhook event retryable. Covered by automated integration tests.

This document intentionally contains no secrets or live provider identifiers.

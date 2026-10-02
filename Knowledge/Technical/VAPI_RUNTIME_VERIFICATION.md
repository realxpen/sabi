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

Vapi Preview environment values have now been entered, including `SABI_COMMUNICATION_MODE=vapi-kros`. A new Vercel deployment is still required before those values can be proven at runtime; the account build-rate limit currently blocks that redeploy.

## No-call Vapi readiness proof

The branch now exposes a Preview-only, read-only endpoint:

`GET /api/internal/vapi-readiness`

It reuses the existing verified Vapi HTTP runtime driver and performs only documented read operations:

```text
GET /assistant/:id
GET /phone-number
```

The check verifies that:

1. the configured private Vapi API key can access the configured saved assistant;
2. the returned assistant ID matches SABI's configured assistant;
3. at least one Vapi `byo-phone-number` is attached to the configured SIP trunk credential;
4. `SABI_COMMUNICATION_MODE` is `vapi-kros`;
5. webhook bearer authentication is configured.

The endpoint returns only sanitized status. It never returns assistant IDs, SIP credential IDs, phone numbers, API keys, or webhook secrets. It never creates or initiates a call.

Expected success response shape:

```json
{
  "provider": "vapi",
  "status": "VERIFIED",
  "missingConfiguration": [],
  "communicationMode": "vapi-kros",
  "webhookAuthConfigured": true,
  "ready": true,
  "checkedAt": "<timestamp>"
}
```

Only after this no-call readiness proof succeeds should the authenticated webhook persistence proof run.

## Runtime checks

1. Fresh preview reports database configuration present and reachable. ✅
2. Required persistence tables are visible to the preview connection. ✅
3. Preview `quotes` schema carries `quantity` / `unit`. ✅
4. Vercel check succeeds on the last deployable preview SHA. ✅
5. Preview-only Vapi readiness endpoint is implemented and covered by automated tests. ✅
6. Fresh post-secret Vercel deploy returns Vapi readiness `VERIFIED` + `ready:true`. Pending Vercel build-rate reset.
7. A synthetic, authenticated Vapi-shaped completion event can persist communication evidence. Pending fresh Preview runtime proof.
8. Explicit provider confirmation of 20 yards can produce a Quote carrying factual quantity/unit evidence. Pending HTTP runtime proof; covered by automated integration tests.
9. The same event can yield a `READY` recommendation when all hard constraints pass. Pending HTTP runtime proof; covered by automated integration tests.
10. Missing quantity confirmation must remain `BLOCKED_UNKNOWN`. Covered by automated integration tests.
11. No-answer must not create a Quote. Covered by automated integration tests.
12. Persistence failure must leave the webhook event retryable. Covered by automated integration tests.

This document intentionally contains no secrets or live provider identifiers.

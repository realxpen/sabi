# Neon Runtime Status

Status: CONNECTED
Last verified: 2026-10-02

## SABI Neon project

- Project: `Sabi`
- Project ID: `silent-meadow-13882415`
- Default branch: `production`
- Database: `neondb`
- Role: `neondb_owner`
- Region: AWS `us-east-2`

## Vercel integration

The existing SABI Vercel project is connected to the existing Sabi Neon project through the Neon-managed Vercel integration.

Observed integration-created branch:

- `vercel-dev`
- creation source: `vercel`
- parent: `production`

Expected preview behavior: new Vercel preview deployments should receive an isolated Neon preview branch and an injected `DATABASE_URL`.

## Durable SABI tables

The following tables are deployed and verified on Neon `production`:

- `quotes`
- `approvals`
- `communication_event_claims`
- `mission_snapshots`

`quotes` now includes nullable provider-evidence fields:

- `quantity numeric` with `quantity > 0` when present
- `unit text`

These fields represent provider-confirmed/quoted quantity evidence only. Existing Quotes remain valid with both fields null; missing quantity remains unknown to hard-constraint evaluation.

`mission_snapshots` stores the validated Mission snapshot JSON used by the Vapi → intelligence → Mission persistence integration.

Canonical SQL remains under `db/neon/`.

## Safety boundary

`DATABASE_URL` is server-side only and must never be committed or exposed through `NEXT_PUBLIC_*` variables. Production schema changes require explicit project approval; the `mission_snapshots` table and Quote `quantity`/`unit` columns were explicitly requested and verified on 2026-10-02.

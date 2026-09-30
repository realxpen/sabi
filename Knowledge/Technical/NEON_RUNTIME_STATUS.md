# Neon Runtime Status

Status: CONNECTED
Last verified: 2026-09-30

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

The following tables are deployed on Neon `production`:

- `quotes`
- `approvals`
- `communication_event_claims`

Canonical SQL remains under `db/neon/`.

## Safety boundary

`DATABASE_URL` is server-side only and must never be committed or exposed through `NEXT_PUBLIC_*` variables. Production remains untouched by Lara branch work unless explicitly approved.

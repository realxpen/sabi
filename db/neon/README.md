# SABI Neon persistence

SABI uses Neon Postgres for durable operational records used by the agent-tools integration.

Current schemas:

- `quotes.sql` — validated provider quotes
- `approvals.sql` — pending human approval requests
- `communication-event-claims.sql` — durable webhook idempotency claims

Runtime connection:

- Server-side code reads `DATABASE_URL`.
- The Neon-managed Vercel integration supplies an isolated database branch for preview deployments.
- Do not expose database connection strings through `NEXT_PUBLIC_*` variables or client code.

The canonical domain schemas remain under `lib/schemas`; database tables are persistence adapters, not a second source of truth.

# Phone-First / Vercel-First Collaboration Workflow

Status: ACTIVE
Last updated: 2026-10-01
Applies to: Xpen, Femi, Lara and their coding AIs

## Purpose

SABI collaboration must be possible entirely from a phone.

No collaborator should be blocked because they do not have a local laptop terminal, localhost server, desktop IDE or locally stored project checkout.

The shared operating model is:

```text
Phone
→ GitHub branch/repository
→ coding AI / repository-aware agent
→ commit/push to collaborator branch
→ GitHub CI
→ Vercel Preview deployment
→ inspect preview/API result from phone
→ iterate
→ handoff/PR
```

The deployed Vercel application and branch previews are the shared runtime environment for collaboration.

## Core rules

1. Repository-first — all durable work must exist in GitHub, not only inside an AI chat or temporary coding session.
2. Branch-first — work only on the assigned collaborator branch unless explicitly told otherwise.
3. Preview-first — use Vercel Preview deployments for browser/API verification instead of assuming localhost is available.
4. CI-first verification — use GitHub Actions for typecheck/tests/build where the workflow covers the changed files.
5. No local-only dependency — do not require a teammate to run a database, tunnel, webhook receiver or dev server on their phone.
6. Cloud webhook URLs — integrations that need public callbacks must target the appropriate deployed Vercel Preview/Production HTTPS URL, never `localhost`.
7. Cloud environment variables — secret configuration belongs in Vercel/provider dashboards, never in GitHub, chat, screenshots or committed files.
8. Environment names, not values — when access is missing, report the environment-variable names/artifacts required; never ask the teammate to paste secret values into the coding prompt.
9. Preview isolation — use Preview deployments for experimental integration work. Do not switch Production into live-call/payment behavior without explicit approval.
10. Production remains deliberate — a successful Preview does not authorize merging, promoting or enabling production integrations automatically.

## What the collaborator AI must do first

At the beginning of every session:

1. inspect the live GitHub repository/assigned branch;
2. read `AGENTS.md`, `PROJECT_STATE.md`, the teammate's ACTIVE prompt and relevant Knowledge files;
3. compare the assigned branch with `main`;
4. inspect recent CI/Vercel status when available;
5. identify the current Preview URL/deployment state if runtime verification is needed;
6. distinguish code that is committed, code that passed CI, code that deployed, and external integrations that were actually exercised.

Never treat these as equivalent:

```text
code written
≠ typecheck passed
≠ tests passed
≠ Vercel build succeeded
≠ endpoint exercised
≠ external partner integration verified
```

## Building from a phone

A collaborator may give the repo/branch and their assigned prompt to a repository-aware coding AI.

The AI should:

- inspect the repository itself;
- edit files on the assigned branch;
- commit/push changes;
- use GitHub CI results as verification evidence;
- use Vercel Preview deployment as runtime verification evidence;
- report the exact commit SHA and deployment/check status;
- keep unfinished external-account steps clearly marked as BLOCKED or NEEDS LIVE VERIFICATION.

The collaborator should not have to copy whole files between chat and GitHub manually.

## Vercel runtime policy

SABI is deployed to Vercel, so public runtime testing should use the deployed branch Preview.

### API testing

When an API route needs testing:

```text
https://<preview-host>/api/...
```

Use the Preview URL generated for the branch/commit.

Do not hard-code the Preview hostname into application logic.

Use `SABI_PUBLIC_BASE_URL` or the appropriate runtime-derived URL/configuration where the architecture requires a stable public base URL.

### Webhooks

Provider webhooks must point to public HTTPS routes such as:

```text
https://<preview-host>/api/webhooks/krosai
https://<preview-host>/api/webhooks/vapi
```

Only configure a provider webhook after the route is deployed and its authentication/verification behavior is understood.

### Secrets

Examples of server-side configuration belong in Vercel/project-provider environment settings:

- database connection strings
- KrosAI API keys/secrets
- Vapi keys/tokens
- BimpeAI keys/tool tokens
- Spitch/YarnGPT/Temlio credentials
- consented-provider phone mapping

Never create `NEXT_PUBLIC_*` secrets.

## Database policy

Use the configured cloud database/runtime connection from the Vercel environment.

Do not make a phone collaborator install or run PostgreSQL locally.

When Preview databases/branches are available, prefer them for branch testing.

Production database mutation requires the same deliberate review as Production deployment.

## External partner verification levels

Every collaborator must label integration status accurately:

### LEVEL 0 — CODE ONLY
Adapter/routes/types exist but no runtime verification.

### LEVEL 1 — CI VERIFIED
Relevant tests/typecheck/build passed.

### LEVEL 2 — VERCEL VERIFIED
Branch Preview deployed successfully and SABI endpoint/runtime can load.

### LEVEL 3 — PARTNER API VERIFIED
The deployed Preview successfully communicated with the actual partner API/account.

### LEVEL 4 — END-TO-END VERIFIED
The real external action completed and returned through the deployed SABI callback path, e.g. consented phone call → webhook → canonical CommunicationResult.

Never report a higher level than was actually observed.

## Phone-friendly teammate handoff

Every work session ends with a compact handoff containing:

- branch
- latest commit SHA
- files/feature changed
- CI status
- Vercel Preview status/link if available
- external verification level (0–4)
- blockers/access required
- environment-variable names required, never values
- exact next action
- whether Xpen needs to merge/review anything

## Merge rule

Collaborators do not merge to `main` merely because Vercel deployed successfully.

Before merge:

1. compare branch to `main`;
2. ensure scope matches assigned ownership;
3. verify tests/build;
4. review shared-contract changes;
5. create/review PR or explicit Xpen integration checkpoint;
6. merge only after integration review.

## Final principle

The phone is only the interface.

GitHub is the durable code workspace, Vercel is the shared cloud runtime, CI is the automated verifier, and the teammate's coding AI performs repository-aware implementation.

No collaborator should need localhost to contribute effectively to SABI.

# Femi — Phone-First SABI Build Workflow

Status: ACTIVE
Owner: Femi
Branch: `femi/intelligence`

## Purpose

Femi does not need to manually code the intelligence track. He can supervise a coding AI from his phone using ChatGPT + GitHub + Vercel.

## Workflow

1. Connect GitHub to ChatGPT and authorize access to `realxpen/sabi`.
2. Work only on branch `femi/intelligence`.
3. Start a new ChatGPT coding session and give it:
   - Repository: `realxpen/sabi`
   - Branch: `femi/intelligence`
   - Master prompt: `Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`
4. Tell the AI to inspect the repository before editing anything and read at minimum:
   - `AGENTS.md`
   - `PROJECT_STATE.md`
   - `Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`
   - `Knowledge/Technical/PHONE_FIRST_COLLABORATION.md`
5. Let the AI follow Femi's track in order:
   - F1 provider/demo data
   - F2 hard filtering
   - F3 ranking
   - F4 Quote validation/intelligence
   - F5 Knowledge/RAG
   - F6 Bimpe Knowledge mapping
   - F7 recommendation logic
   - F8 evaluation/tests
6. After each useful checkpoint, the AI should:
   - run the relevant tests;
   - run typecheck/build where appropriate;
   - commit;
   - push to `femi/intelligence`.
7. GitHub push should trigger CI and a Vercel Preview deployment.
8. Femi reviews the Vercel Preview from his phone. No localhost is required.
9. If CI/Vercel fails, give the exact error back to the AI and fix it on the same branch.
10. Do not merge directly to `main`.

## What Femi owns

Femi builds SABI's decision intelligence:

- provider/demo data quality;
- hard-constraint filtering;
- valid-option ranking;
- Quote validation;
- Knowledge/RAG retrieval;
- explainable recommendations;
- evaluation/tests.

He does not own telephony/webhooks or the main UI.

## Completion report

When ready, Femi should send the team:

- what was completed;
- tests/CI result;
- Vercel Preview result;
- latest commit hash;
- blockers/unknowns;
- any shared-contract change requested.

## Important rule

The AI must distinguish between code written, tests passed, deployment succeeded, and real behavior verified. It must never invent missing repository/API details.

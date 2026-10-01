# Lara — Phone-First SABI Build Workflow

Status: ACTIVE
Owner: Lara
Branch: `lara/agent-tools`

## Purpose

Lara does not need to manually code the communication/integration track. She can supervise a coding AI from her phone using ChatGPT + GitHub + Vercel.

## Workflow

1. Connect GitHub to ChatGPT and authorize access to `realxpen/sabi`.
2. Work only on branch `lara/agent-tools`.
3. Start a new ChatGPT coding session and give it:
   - Repository: `realxpen/sabi`
   - Branch: `lara/agent-tools`
   - Master prompt: `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
4. Tell the AI to inspect the repository before editing anything and read at minimum:
   - `AGENTS.md`
   - `PROJECT_STATE.md`
   - `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
   - `Knowledge/Technical/PHONE_FIRST_COLLABORATION.md`
5. Do not restart Lara's section from scratch. Inspect the existing `lara/agent-tools` branch first and continue only from unfinished parts.
6. Lara's core responsibility is SABI's communication/action layer:
   - provider tools;
   - call-provider flow;
   - Vapi/KrosAI integration;
   - communication adapters;
   - webhooks;
   - call lifecycle/status;
   - no-answer/failure handling;
   - Neon persistence;
   - observability/recovery;
   - truthful conversion of external results into `CommunicationResult`/Quote evidence.
7. The main remaining milestone is live verification:
   - SABI triggers the call;
   - Vapi/KrosAI reaches a consenting real phone;
   - the call lifecycle completes;
   - webhook reaches Vercel;
   - mission/provider correlation is correct;
   - canonical communication state/result is saved.
8. After each useful checkpoint, the AI should:
   - run the relevant tests;
   - run typecheck/build where appropriate;
   - commit;
   - push to `lara/agent-tools`.
9. GitHub push should trigger CI and a Vercel Preview deployment.
10. Lara tests the deployed Preview/API/webhook from her phone. No localhost is required.
11. Store live secrets only in Vercel/environment configuration. Never put API keys, phone numbers, webhook tokens or database credentials into GitHub files or ChatGPT messages.
12. The AI must distinguish these levels:
   - code written;
   - tests passed;
   - Vercel deployed;
   - partner API verified;
   - real end-to-end phone call verified.
13. If the AI needs a dashboard/account value it cannot access, it should tell Lara exactly what setting/ID is needed instead of guessing.
14. Do not merge directly to `main`.

## Completion report

When ready, Lara should send the team:

- what was completed;
- what remains pending;
- tests/CI result;
- Vercel Preview result;
- real-call/live-partner status;
- latest commit hash;
- remaining account/credential setup names;
- any shared-contract change requested.

## Important rule

A successful build or Vercel deployment does not mean the live communication path is complete. The final proof is one consented real call returning through the deployed webhook into the correct SABI mission state.

# Codex Master Prompt — Phase 1 MVP Skeleton

Status: COMPLETED / HISTORICAL PROMPT
Completed: 2026-09-29

This prompt was used to establish the shared Phase 1 foundation. Do **not** use it as the current integration prompt.

## What this prompt produced

The Phase 1 foundation now on `main` includes:

- Next.js + TypeScript application scaffold
- canonical shared schemas
- deterministic Mission state machine
- provider-neutral communication adapter
- mock communication adapter
- Mission Control shell
- mock Mission engine through `AWAITING_APPROVAL`
- human-approval UI
- focused tests + CI

## Current source of truth

For current work, read:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `Knowledge/Decisions/ACTIVE_DECISIONS.md`
4. `Knowledge/Product/TEAM_BUILD_PHASES.md`
5. relevant teammate prompt
6. relevant ACTIVE technical knowledge

### Xpen

Use current project state + integration docs to coordinate the integrated loop and Bimpe/tool orchestration.

### Femi

Use:

`Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`

### Lara

Use:

`Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`

and:

- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
- `Raw/PartnerDocs/SOURCE_LINKS.md`

## Current integration direction

```text
SABI Next.js
→ BimpeAI workflow / Knowledge / bounded SABI tools
→ KrosAI telephony
→ Vapi first
→ provider phone
→ Kros webhook/transcript
→ CommunicationResult / Quote
→ Femi intelligence
→ Xpen Mission Control
→ human approval
```

Optional advanced path after the golden path is stable:

```text
KrosAI → LiveKit → Spitch STT/TTS → SABI/Bimpe tools
```

Do not use the old Phase 1 instructions to create a second architecture or reintroduce placeholders that have now been resolved by verified partner documentation.

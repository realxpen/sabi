# PROJECT_STATE.md

Status: ACTIVE
Last updated: 2026-10-01

## Latest update — 2026-10-03

Public provider registration implemented at Xpen’s request: removed the operator-token field, browser token storage and bearer header from vendor onboarding; removed operator authentication only from provider creation. Explicit consent, validation and private phone storage remain. Deployment of this update is pending.

The historical status below predates the main-branch integration release; production was verified on `e5fbe6ed0d8f0186e6df8c3316d7a5c6ecc7f6f2` before this update.

## Current phase

**Phase 1 — Integrated Golden Path / External Live Verification**

The core hackathon product path is now implemented in code on the clean integration branch. The main remaining critical gap is external live verification: Kros/Vapi phone transport and Bimpe account-side configuration.

## Event target

- Event: Lagos Agentic AI Build Day / Hack Night
- Date: 2026-10-03
- Location: Civic Hive, Yaba, Lagos

## Product

**SABI — AI Agent for the Informal Economy**

> Tell SABI what you need. SABI helps you get it done.

Canonical demo:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Current integration branch

```text
integration/runtime-mission-control
```

Draft integration PR:

```text
#7 — Wire live communication and intelligence into Mission Control
```

Base: `xpen/mvp-shell`

Do not merge blindly. Review the integrated golden path and live-verification evidence first.

## Completed product/runtime foundation

- [x] product source + MVP boundary
- [x] trust/human-approval model
- [x] Next.js + TypeScript scaffold
- [x] canonical Zod schemas
- [x] deterministic Mission state machine
- [x] persisted Mission snapshots in Neon
- [x] Mission create/read lifecycle
- [x] Mission Control from persisted state
- [x] human approval persistence with no transaction
- [x] live-refresh Mission Control
- [x] provider-neutral CommunicationResult contract
- [x] Lara Vapi/Kros communication adapter code
- [x] authenticated Vapi webhook code
- [x] durable webhook-event deduplication
- [x] retry-safe webhook → Mission persistence
- [x] call initiation → Mission Control persistence
- [x] Femi hard-constraint filtering
- [x] deterministic qualifying-option ranking
- [x] explainable recommendation output
- [x] runtime Knowledge/context layer
- [x] recommendation → Mission Control persistence
- [x] progressive Mission orchestration
- [x] explicit SIMULATION vs LIVE separation
- [x] bounded Bimpe-facing SABI tool surface
- [x] agent-tool bearer authentication
- [x] Quote source-reference requirement
- [x] Mission-stage gates on Quote/comparison/approval actions
- [x] Bimpe runtime prompt pack
- [x] Bimpe durable Knowledge pack
- [x] Bimpe Custom API setup guide
- [x] GitHub CI typecheck/test/build gates

## Progressive Mission runtime

A newly created Mission now starts at `CREATED` and advances through real persisted states rather than appearing instantly at the end of a fixture flow:

```text
CREATED
→ UNDERSTANDING
→ PLANNING
→ SEARCHING
→ CONTACTING
→ COLLECTING_QUOTES
→ COMPARING
→ AWAITING_APPROVAL
```

`AWAITING_APPROVAL` is a hard human checkpoint.

Simulation mode may use explicitly labelled fixtures. Live mode must never fall back to simulation providers, communication outcomes, or Quotes.

## Current bounded agent-tool surface

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
orchestrateMission
requestApproval
```

Source-of-truth code:

- `lib/integrations/bimpe/tool-manifest.ts`
- `app/api/agent-tools/[tool]/route.ts`
- `app/api/agent-tools/call-provider/route.ts`

All agent-tool actions are bounded. They do not expose unrestricted database access.

## Bimpe configuration pack

Ready in the repository:

- `Knowledge/Technical/BIMPE_SABI_AGENT_PROMPT.md`
- `Knowledge/Technical/BIMPE_KNOWLEDGE_BASE.md`
- `Knowledge/Technical/BIMPE_CUSTOM_API_SETUP.md`
- `Knowledge/Technical/MISSION_ORCHESTRATION_RUNTIME.md`

Account-side Bimpe configuration is still external work; do not claim it is live until the actual agent/workflow/Custom API actions are configured and invoked.

## Intelligence status — Femi

Femi's core hackathon intelligence module is implemented and integrated.

Current deterministic flow:

```text
validated Mission + Providers + Quotes
→ hard constraints
→ exclude invalid options with reasons
→ rank qualifying options
→ explain recommendation
→ persist recommendation
→ request human approval
```

Canonical example:

```text
A — ₦63k / tomorrow / available → qualifies
B — ₦55k / 3 days → reject deadline
C — ₦74k / tomorrow → reject hard budget
D — no answer → no Quote
```

Do not add unnecessary ML before the golden path is live-verified.

## Communication status — Lara

Lara's core communication/runtime code is implemented. The remaining critical work is external account/transport proof.

Implemented:

- Vapi/Kros adapter boundary
- consent-gated live destinations
- initiation semantics
- webhook normalization
- correlation
- event deduplication
- retry/recovery behavior
- Mission persistence
- truthful NO_ANSWER/FAILED handling
- transcript-is-evidence rule

Still unverified end-to-end:

```text
SABI
→ Vapi
→ Kros number/SIP transport
→ consenting test phone rings
→ answer/conversation
→ Vapi webhook
→ correct Mission correlation
→ CommunicationResult persists
→ Mission Control displays result
```

## External access gates

### KrosAI — critical

- [x] KYC completed by Xpen
- [ ] hackathon/usable phone number provisioned
- [ ] sponsored/usable call credit confirmed
- [ ] outbound calling permission confirmed
- [ ] SIP credentials obtained/verified
- [ ] Kros number connected to the selected Vapi BYO/SIP path
- [ ] one consenting test phone rings
- [ ] call lifecycle verified
- [ ] webhook/result returns to SABI

Do not personally buy unnecessary call credit before checking hackathon provisioning/support.

### Vapi — critical runtime

Code support exists, but account-side values/live path still require verification:

- [ ] intended Vapi account/API key configured in Preview
- [ ] SABI provider-calling Assistant verified
- [ ] Assistant ID configured
- [ ] SIP Trunk Credential ID configured
- [ ] Kros BYO/SIP phone path verified
- [ ] Vapi webhook token + endpoint configured
- [ ] one real consented call verified

### BimpeAI — core agent layer

Repository assets are ready; account-side configuration remains:

- [ ] SABI Bimpe agent/workflow selected or created
- [ ] `BIMPE_SABI_AGENT_PROMPT.md` applied
- [ ] `BIMPE_KNOWLEDGE_BASE.md` added as curated durable Knowledge
- [ ] `SABI_AGENT_TOOL_TOKEN` configured securely on both sides
- [ ] Custom API actions registered from `BIMPE_CUSTOM_API_SETUP.md`
- [ ] one simulation tool invocation verified from Bimpe
- [ ] full simulated orchestration verified from Bimpe
- [ ] live `callProvider` enabled only after Kros/Vapi readiness

## Preview database

Integration Preview Neon branch:

```text
preview/integration/runtime-mission-control
```

Required tables available there:

```text
mission_snapshots
communication_event_claims
quotes
approvals
```

Production Neon has not been intentionally modified by the integration work.

## Verification levels

Use these labels consistently:

```text
Level 0 — code only
Level 1 — GitHub CI verified
Level 2 — Vercel Preview/runtime verified
Level 3 — partner API/account verified
Level 4 — real end-to-end external action verified
```

Do not collapse these levels into one claim.

## Current verified status

Core orchestration and Bimpe-facing tool code has passed GitHub CI (typecheck, tests and Next.js production build). Exact-head CI must always be checked again after functional changes.

Vercel has recently rate-limited additional Preview builds. That is a hosting quota/rate gate, not permission to stop development or to claim deployment proof that did not occur.

## What can continue without the Kros phone number

- Bimpe account/workflow setup
- upload/apply SABI agent prompt
- upload/apply curated Knowledge
- configure bounded Custom API actions
- simulate the full Mission lifecycle through the bounded tools
- improve demo reliability and failure UX
- review PR #7 integration diff
- keep tests/typecheck/build green
- prepare live-call checklist and consented test provider mapping structure

## What specifically waits for the phone number/credits

Only the external voice proof:

```text
Kros number/SIP
→ Vapi BYO phone path
→ real consented outbound call
→ live provider conversation
→ webhook/event
→ persisted CommunicationResult
→ Mission Control update
```

## Demo freeze gate

Freeze feature expansion when this becomes repeatable:

```text
Mission created
→ providers discovered
→ at least one verified communication path exercised
→ factual provider response captured
→ Quote validated
→ valid options compared
→ recommendation explained
→ Mission Control updated
→ human approval requested
```

The hackathon MVP still performs no real payment or escrow transaction.

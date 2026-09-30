# PROJECT_STATE.md

Status: ACTIVE
Last updated: 2026-09-30

## Current phase

**Phase 1 — Parallel Build / Verified Integration Handoff**

Phase 0 is complete. The shared Phase 1 foundation, mock Mission Control path, teammate prompts, partner research, integration architecture, and verified build order are normalized on `main`.

## Event target

- Event: Lagos Agentic AI Build Day / Hack Night
- Date: 2026-10-03
- Location: Civic Hive, Yaba, Lagos

## Product

**SABI — AI Agent for the Informal Economy**

> Tell SABI what you need. SABI helps you get it done.

Canonical demo:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Completed foundation

- [x] product source + MVP boundary
- [x] trust/human-approval model
- [x] team ownership/build phases
- [x] Next.js + TypeScript scaffold
- [x] canonical Zod schemas
- [x] Mission/Provider/Quote/MissionStep/Approval/CommunicationResult
- [x] deterministic Mission state machine
- [x] provider-neutral communication adapter
- [x] mock communication adapter
- [x] Home → Mission Control flow
- [x] mock Mission engine through `AWAITING_APPROVAL`
- [x] provider/Quote/recommendation UI
- [x] human-approval UI with no real transaction
- [x] focused tests + GitHub CI
- [x] LLM Knowledge/Retrieval architecture
- [x] teammate-specific Codex prompts
- [x] verified partner source map
- [x] integration stack decision
- [x] integration access checklist
- [x] active decisions updated from verified docs
- [x] README/AGENTS/env/build-plan normalization

Current mock provider responses/recommendation are temporary fixtures and must be replaced by teammate modules rather than presented as live provider results.

## Current integration source of truth

- `AGENTS.md`
- `Knowledge/Decisions/ACTIVE_DECISIONS.md`
- `Knowledge/Product/TEAM_BUILD_PHASES.md`
- `Knowledge/Technical/ARCHITECTURE.md`
- `Knowledge/Technical/INTEGRATION_CONTRACTS.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
- `Knowledge/Technical/LLM_KNOWLEDGE_ARCHITECTURE.md`
- `Raw/PartnerDocs/SOURCE_LINKS.md`

## Primary stack

```text
SABI Next.js / domain state
→ BimpeAI workflow + Knowledge + bounded SABI tools
→ SABI callProvider
→ KrosAI telephony
→ Vapi first
→ provider phone
→ Kros webhook/transcript
→ CommunicationResult
→ validated Quote
→ Femi filtering/ranking
→ Xpen Mission Control
→ human approval
```

## Advanced language path

Only after the primary phone loop works:

```text
KrosAI → LiveKit SIP → LiveKit Agent → Spitch STT/TTS → SABI/Bimpe tools
```

YarnGPT is optional for African TTS/translation/streaming/post-call STT.

Temlio is optional SMS/communications fallback pending detailed API contract/access.

## Binding integration decisions

- SABI remains system of record for Mission, Provider, CommunicationResult, Quote, recommendation and Approval.
- BimpeAI is the agent/workflow/Knowledge/bounded-tool layer, not the Mission database.
- Use Bimpe REST/native server-side `fetch` first because current Bimpe TS SDK docs target Node 24+ while SABI CI is Node 20.
- KrosAI is the primary telephony transport.
- Vapi is the first voice-runtime candidate; Retell then ElevenLabs are fallbacks.
- Kros official docs conflict on `/v1` vs `/api/v1` and outbound singular/plural paths; keep `KROSAI_BASE_URL` configurable and confirm live route before freeze.
- Kros webhook event naming differs across official pages; keep aliases/version mapping inside one adapter and confirm live dashboard schema.
- Webhook processing must verify signature, deduplicate event IDs and preserve correlation.
- A transcript is evidence, not automatically a Quote.
- Durable policies may live in Bimpe/SABI Knowledge; live price/availability/call outcomes stay operational/tool data.
- Multilingual and SMS fallback work may not block or destabilize the golden path.

## Xpen — Product & Integration

Branch: `xpen/mvp-shell`

Current gates:

1. integrate Femi + Lara mock-ready modules
2. configure Bimpe workflow/agent/Knowledge + bounded SABI API tool seam
3. connect real Kros transport once Lara proves it
4. replace temporary fixtures with real module results
5. own final golden-path demo/freeze

## Femi — Intelligence, Data & Knowledge

Branch: `femi/intelligence`

Use `Knowledge/Technical/CODEX_FEMI_INTELLIGENCE_PROMPT.md`.

Track:

- provider/Quote fixtures
- hard constraints
- transparent ranking
- Quote intelligence
- runtime Knowledge/retrieval/context assembly
- Bimpe Knowledge-Base content mapping
- recommendation output
- evaluation

## Lara — Agent Tools & Communication

Branch: `lara/agent-tools`

Use:

- `Knowledge/Technical/CODEX_LARA_AGENT_TOOLS_PROMPT.md`
- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`

Track:

- bounded tools
- communication adapter
- event normalization
- Kros webhook/signature/idempotency
- failure/recovery
- real Kros transport
- Vapi first runtime
- optional Spitch/LiveKit language path
- optional Temlio fallback only with verified contract

## Current external access gates

### KrosAI — critical

- [ ] account/access
- [ ] KYC
- [ ] API key/scopes
- [ ] phone number/event credits
- [ ] confirmed live REST route
- [ ] endpoint attached
- [ ] one consented test call
- [ ] verified webhook/signature
- [ ] transcript/result

### Vapi — critical candidate

- [ ] account/API key
- [ ] SABI provider-calling Assistant
- [ ] Assistant ID
- [ ] SIP Trunk Credential ID
- [ ] Kros BYO/SIP path tested

### BimpeAI — core agent layer

- [ ] API key
- [ ] workflow
- [ ] SABI agent
- [ ] curated Knowledge Base
- [ ] SABI Custom API integration
- [ ] at least one bounded tool invocation

### Spitch/LiveKit — optional enhancement

- [ ] Spitch key
- [ ] LiveKit credentials only if multilingual path is attempted

### YarnGPT — optional

- [ ] key/credits only if selected

### Temlio — optional fallback

Still need detailed partner/event API auth/request/webhook documentation before live coding.

## Next integration gate

First complete:

```text
request
→ validated Mission
→ provider discovery
→ mock/real communication through shared adapter
→ CommunicationResult
→ validated Quote
→ filtering/ranking
→ recommendation
→ Mission Control
→ human approval
```

Then prove the first real external gate:

```text
Kros account/KYC/number
→ confirmed live route
→ one consented real call
→ one verified webhook/transcript
→ CommunicationResult
```

Do not add optional partner integrations before this is stable.

## Demo freeze gate

Freeze the primary stack when this is repeatable:

```text
Mission created
→ candidate selected
→ consented phone receives call
→ provider response captured
→ Quote validated
→ options compared
→ Mission Control updated
→ human approval requested
```

The hackathon MVP still performs no real payment/escrow transaction.

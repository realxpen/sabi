# SABI

**SABI — AI Agent for the Informal Economy**

SABI helps people get real-world products and services by expressing an outcome in natural language. Instead of making a user search across Instagram, WhatsApp, Google, contacts and marketplaces, SABI can understand the request, find relevant providers, contact them through channels they already use, collect factual information, compare qualifying options and return a recommendation while keeping the human in control of consequential actions.

> **Core principle:** Tell SABI what you need. SABI helps you get it done.

## Hackathon MVP

```text
User request
→ structured Mission
→ provider discovery
→ provider contact
→ structured Quote collection
→ comparison
→ recommendation
→ human approval
```

Canonical demo mission:

> “I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.”

The MVP stops at human approval. It does **not** perform real payment, escrow release, delivery settlement or autonomous purchasing.

## Current implementation state

Phase 0 is complete.

Phase 1 currently includes:

- Next.js + TypeScript scaffold
- canonical Zod schemas
- deterministic Mission state machine
- provider-neutral communication adapter contract
- mock communication adapter
- mock Mission engine through `AWAITING_APPROVAL`
- Mission Control UI
- mock provider/Quote cards
- human-approval UI
- focused tests + GitHub CI
- verified partner-integration research and build plan
- current teammate-specific Codex prompts

See `PROJECT_STATE.md` for the exact checkpoint.

## Verified integration direction

Primary hackathon path:

```text
SABI Next.js
→ BimpeAI agent/workflow/Knowledge + bounded SABI tools
→ SABI callProvider
→ KrosAI telephony
→ Vapi first
→ provider phone
→ Kros webhook/transcript
→ CommunicationResult / Quote
→ Femi intelligence
→ Xpen Mission Control
→ human approval
```

Optional advanced language path after the base loop works:

```text
KrosAI → LiveKit → Spitch STT/TTS → SABI/Bimpe tools
```

YarnGPT is an optional African-voice enhancement. Temlio is an optional SMS/communications fallback once detailed partner API contracts/access are available.

## Important integration notes

- **SABI remains system of record** for Mission, Provider, CommunicationResult, Quote, recommendation and Approval.
- **BimpeAI** is the agent/workflow/Knowledge/bounded-tool layer, not the Mission database.
- **KrosAI** is the primary telephony transport.
- **Vapi** is the first voice-runtime candidate; Retell/ElevenLabs are fallbacks.
- Current official Kros docs show conflicting `/v1` vs `/api/v1`/outbound path examples, so the live route must be confirmed through API Explorer/minimal testing and remains configurable.
- Kros webhook event names also differ across official pages; aliases/version mapping stays inside the Kros adapter until the live schema is confirmed.
- The current Bimpe TypeScript SDK documents Node 24+ while SABI CI is Node 20, so the first Bimpe integration should use REST/native server-side `fetch` unless the runtime is deliberately upgraded and retested.
- Live provider facts never belong in static Knowledge/RAG merely because an LLM needs them; they come from operational data/tool results.

## Project structure

```text
Raw/
  Hackathon/
  PartnerDocs/
  Research/

Knowledge/
  Product/
  Research/
  UX/
  Technical/
  Business/
  Decisions/

app/
components/
lib/
tests/

AGENTS.md
PROJECT_STATE.md
README.md
```

This repository follows the AED knowledge-first pattern:

```text
Knowledge
→ Specification
→ Architecture
→ Experience
→ Code
```

## Team

- **Xpen — Product & Integration Lead**
- **Femi — Intelligence, Data & Knowledge Lead**
- **Lara — Agent Tools & Communication Lead**

See:

- `Knowledge/Product/TEAM_OWNERSHIP.md`
- `Knowledge/Product/TEAM_BUILD_PHASES.md`

## Start here

Coding agents/contributors should read in this order:

1. `AGENTS.md`
2. `PROJECT_STATE.md`
3. `Knowledge/Product/SABI_PRODUCT_SOURCE.md`
4. `Knowledge/Product/MVP_SCOPE.md`
5. `Knowledge/Decisions/ACTIVE_DECISIONS.md`
6. relevant ACTIVE files under `Knowledge/`

For partner/integration work also read:

- `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
- `Knowledge/Technical/INTEGRATION_STACK_DECISION.md`
- `Knowledge/Technical/INTEGRATION_ACCESS_CHECKLIST.md`
- `Raw/PartnerDocs/SOURCE_LINKS.md`

## Branches

```text
xpen/mvp-shell
femi/intelligence
lara/agent-tools
```

Shared contracts must not be changed silently. Partner secrets must never be committed.

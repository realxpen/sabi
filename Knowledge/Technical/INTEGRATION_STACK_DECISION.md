# SABI Integration Stack Decision

Status: ACTIVE PLAN
Last verified: 2026-09-30

## Decision objective

Choose the smallest partner stack that demonstrates a real agentic loop reliably while preserving SABI's own Mission, trust, quote, and approval architecture.

## System-of-record boundary

SABI remains the system of record for:

- Mission
- Provider
- CommunicationResult
- Quote
- recommendation inputs/results
- Approval
- guardrails
- external correlation IDs

External agent/voice providers may reason, speak, transport calls, or invoke tools; they do not silently redefine these domain objects.

## Primary hackathon stack

```text
SABI Next.js
  ↓
BimpeAI — workflow / knowledge / bounded tool orchestration
  ↓
SABI callProvider tool
  ↓
KrosAI — local number + phone transport + call lifecycle
  ↓
Vapi — primary fast voice-runtime candidate
  ↓
Provider phone
  ↓
KrosAI webhook / transcript
  ↓
CommunicationResult → Quote
  ↓
Femi intelligence
  ↓
Xpen Mission Control
  ↓
HUMAN APPROVAL
```

### Why Vapi is the first voice-runtime candidate

KrosAI's official integration material positions Vapi around structured workflows/tool calling/function execution and documents a concrete SIP/BYO-number path.

The objective is not to declare Vapi permanently superior. It is to test the shortest reliable path first.

## Fallback voice runtime

If Vapi cannot be made reliable quickly:

1. Retell
2. ElevenLabs

Choose one; do not integrate both as critical-path dependencies.

## Advanced multilingual stack

Once the base phone loop works:

```text
KrosAI number
→ LiveKit SIP
→ LiveKit Agent
→ Spitch STT/TTS
→ LLM/SABI tools
```

This path is technically strong because both KrosAI and Spitch document LiveKit integrations, but it introduces LiveKit worker/SIP/runtime setup and therefore comes after the reliable base demo.

## YarnGPT role

YarnGPT is optional for:

- African voice TTS
- translated synthesized responses
- post-call/file STT
- standalone voice enhancement

Do not make YarnGPT ASR the critical real-time phone loop in the first implementation because its documented STT flow is asynchronous and polled.

## Temlio role

Temlio is the planned communication fallback, especially SMS after `no_answer`, `busy`, or call failure.

Public material confirms Voice/SMS/USSD REST capabilities, but the implementation contract is not public enough to code safely. Keep the adapter boundary only until event docs/credentials arrive.

## BimpeAI role

BimpeAI should provide:

- workflow/system prompt
- SABI knowledge base
- bounded custom API tools
- optional agent channels/test environment

BimpeAI should not replace SABI's Mission database/state machine.

There is no verified public documentation of a native BimpeAI ↔ KrosAI integration, so the bridge is SABI-owned APIs/tools.

## Runtime compatibility decision

BimpeAI's TypeScript SDK currently documents Node 24+ support. SABI CI currently runs Node 20.

For the first integration:

**Prefer BimpeAI REST API through native `fetch` while retaining Node 20.**

Only switch to `@bimpeai/sdk` after intentionally upgrading CI/runtime to Node 24 and verifying the Next.js build/tests.

This avoids an unnecessary runtime migration during the hackathon.

## KrosAI URL decision

KrosAI public docs currently show both `/v1` and `/api/v1` examples and inconsistent singular/plural outbound-call paths.

Therefore:

- use `KROSAI_BASE_URL` configuration
- keep route construction in one Kros adapter
- verify the actual live path with API Explorer/dashboard/minimal request
- record the confirmed live endpoint before demo freeze

## Demo freeze rule

The primary demo stack is frozen once all of these are repeatable:

```text
Mission created
→ candidate provider selected
→ real consented test phone receives call
→ provider response captured
→ quote normalized
→ valid options compared
→ Mission Control updates
→ human approval requested
```

After this point, multilingual voice/SMS/secondary providers are optional enhancements and may not destabilize the golden path.

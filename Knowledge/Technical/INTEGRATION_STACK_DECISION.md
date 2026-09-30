# SABI Integration Stack Decision

Status: ACTIVE PLAN
Last verified: 2026-09-30

## Decision objective

Use the smallest partner stack that proves a real agentic loop reliably while preserving SABI's own Mission, trust, Quote and Approval architecture.

## System-of-record boundary

SABI remains authoritative for:

- Mission
- Provider
- CommunicationResult
- Quote
- recommendation inputs/results
- Approval
- guardrails
- external correlation IDs

External agent/voice providers may reason, speak, transport calls, synthesize/transcribe audio or invoke bounded tools; they do not silently redefine SABI domain objects.

## Primary hackathon stack

```text
SABI Next.js
→ BimpeAI workflow / Knowledge / bounded SABI tools
→ SABI callProvider
→ KrosAI telephony
→ Vapi first
→ Provider phone
→ Kros webhook / transcript
→ CommunicationResult
→ Validated Quote
→ Femi intelligence
→ Xpen Mission Control
→ HUMAN APPROVAL
```

## Why BimpeAI is the agent layer

BimpeAI's public docs verify agents bound to workflows, text/URL Knowledge Bases, Custom API integrations/tools, API-key auth/request correlation, and conversation/testing surfaces.

This maps to SABI's knowledge-first architecture while allowing SABI APIs to remain the system of record.

## Bimpe runtime decision

Current `@bimpeai/sdk` docs target Node 24+; SABI CI currently runs Node 20.

First integration:

```text
Next.js server
→ native fetch
→ Bimpe REST API
```

Only adopt the SDK after an intentional Node runtime/CI upgrade and full regression verification.

## Why KrosAI is the telephony transport

KrosAI's current docs verify local phone numbers, inbound/outbound calling, endpoint routing, logs/transcripts/recordings, signed webhooks and Vapi/Retell/ElevenLabs/LiveKit/custom endpoints.

This is the phone-network layer SABI needs.

## Kros URL/version decision

Official Kros docs currently show conflicting examples around `/v1` vs `/api/v1` and singular/plural outbound paths.

Therefore:

- use `KROSAI_BASE_URL`
- centralize Kros route construction
- confirm the live route through API Explorer/dashboard/minimal request
- record the working route before demo freeze

Do not spread remembered URLs throughout the codebase.

## Kros webhook decision

Official Kros pages currently show more than one event naming convention.

Therefore:

- verify live event names/payload through dashboard/API Explorer
- centralize event aliases/version mapping inside the Kros adapter
- verify `X-Webhook-Signature` from raw body
- deduplicate provider event IDs
- normalize to SABI `CommunicationResult` before Mission mutation

## Voice-runtime order

Primary candidate:

```text
KrosAI → Vapi
```

Reason: Kros documents a concrete SIP/BYO path and positions Vapi for structured workflows/tool calling/function execution.

Fallback order if Vapi is not reliable quickly:

1. Retell
2. ElevenLabs

Do not integrate all three as simultaneous critical-path dependencies.

## Advanced multilingual stack

Only after the base phone loop works:

```text
KrosAI number
→ LiveKit SIP
→ LiveKit Agent
→ Spitch STT/TTS
→ SABI/Bimpe tools
```

Both KrosAI and Spitch document LiveKit integrations, making this technically coherent but operationally more complex.

## YarnGPT role

YarnGPT remains optional for African TTS, translated synthesis, low-latency single-turn audio and post-call/file STT.

Its documented ASR flow is asynchronous/polled, so it should not be the first critical real-time phone-ASR path.

## Temlio role

Temlio is planned as optional fallback, especially SMS after `no_answer`, `busy`, or failure.

Public material verifies Voice/SMS/USSD/local-number REST capabilities but not enough request/auth/webhook detail to implement safely. Keep only the adapter boundary until event/partner documentation arrives.

## Bimpe Knowledge decision

Durable policy/domain guidance may be loaded into Bimpe Knowledge Bases.

Examples:

- trust policy
- approval policy
- procurement rules
- provider communication rules
- category guidance

Live provider price, availability, delivery commitment, transcript and call outcome remain operational/tool data in SABI.

## Real-call truthfulness decision

A real external path is successful only when:

```text
call initiation accepted
→ destination rings/answers
→ call completes or fails truthfully
→ webhook/log/transcript correlates to Mission/Provider
→ CommunicationResult is validated
```

API acceptance alone is not call success.

## Demo freeze rule

Freeze the primary demo stack once all are repeatable:

```text
Mission created
→ candidate provider selected
→ real consented phone receives call
→ provider response/transcript captured
→ Quote validated
→ valid options compared
→ Mission Control updates
→ human approval requested
```

After this, multilingual voice, SMS fallback and extra providers are optional enhancements only.

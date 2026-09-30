# Partner Integrations — Verified Technical Map

Status: ACTIVE
Last verified: 2026-09-30

This file records implementation facts verified from current official/public partner documentation and explicitly marks unresolved conflicts. It replaces Phase 0 assumptions where evidence now exists.

## Executive integration rule

Do not put every partner into one critical path.

```text
BimpeAI        = agent workflow / knowledge / bounded tool orchestration
SABI backend   = source of truth for Mission, Provider, CommunicationResult, Quote, Approval
KrosAI         = phone/telephony transport
Voice runtime  = Vapi first; Retell/ElevenLabs as fallbacks
Spitch         = African STT/TTS/translation; strongest advanced path with LiveKit
YarnGPT        = optional African TTS/translation/streaming/post-call STT
Temlio         = optional SMS/communications fallback when detailed API docs arrive
```

No native BimpeAI↔KrosAI bridge is assumed. SABI-owned APIs/tools connect the layers.

---

## 1. KrosAI — Primary Telephony Transport

### Verified role

KrosAI bridges AI voice endpoints to real phone networks and provides local numbers, inbound/outbound calls, call lifecycle, logs, recordings/transcripts, webhooks, and supported voice-runtime integrations.

SABI uses Kros behind `CommunicationAdapter`.

### Prerequisites

- KrosAI account
- KYC before number provisioning/purchase
- server API key
- KrosAI phone number
- configured AI endpoint
- consenting test phone/provider

Server examples authenticate with:

```text
x-api-key: <KROSAI_API_KEY>
```

Use least-privilege scopes for numbers/calls/endpoints/webhooks as required.

### Endpoint providers

Current docs list support for:

- Vapi
- Retell
- ElevenLabs
- LiveKit
- custom/webhook endpoints

### Outbound-call request concepts

Verified fields include:

```text
from_number
to_number
endpoint_id
metadata        optional
webhook_url     optional
max_duration    optional
```

Use E.164 phone numbers.

For SABI correlation, attach when accepted by the live endpoint:

```json
{
  "missionId": "mission_123",
  "providerId": "provider_456",
  "communicationId": "comm_789"
}
```

### REST path conflict

Current official docs are inconsistent:

- Quickstart examples use paths such as `https://api.krosai.com/v1/outbound-calls`.
- Other API-reference pages describe `https://api.krosai.com/api/v1/outbound-calls` and a singular `POST /outbound-call`.

Therefore:

- configure `KROSAI_BASE_URL`
- centralize route construction in the Kros adapter
- verify the actual live path using API Explorer/dashboard/minimal request
- record the confirmed route before demo freeze

### Call lifecycle

Outbound documentation describes a lifecycle conceptually including:

```text
initiated → ringing → answered → in_progress → completed
```

Failure outcomes include:

```text
failed
no_answer
busy
```

Normalize these into SABI `CommunicationResult`. `initiated`/`ringing` are never treated as completed.

### Webhook naming conflict

Current official Kros pages expose more than one naming convention.

The public webhook overview lists:

```text
call.started
call.ended
call.failed
call.recording.completed
transcription.completed
```

Other/current documentation material references a newer style such as:

```text
call.initiated
call.ringing
call.answered
call.completed
call.failed
recording.ready
transcript.ready
```

Do not spread either convention through the application. Keep alias/version mapping inside the Kros adapter and confirm the live event schema in the dashboard/API Explorer.

### Webhook verification / retries

The public webhook docs show:

- `X-Webhook-Signature`
- HMAC-SHA256 over the raw payload with the webhook secret
- repeated retries after failed delivery

SABI must therefore:

1. preserve raw request body
2. verify signature
3. deduplicate provider event ID
4. validate/correlate event
5. respond quickly with 2xx to valid delivery
6. process heavier transcript/Quote work idempotently

### Logs / transcripts

Kros provides call history/detail and recording/transcript capability. Use call logs as an audit/recovery source if webhook delivery is missed.

A transcript is evidence, not automatically a Quote.

### First Kros gate

1. valid account/KYC/key
2. phone number
3. endpoint created/attached
4. one consented test call
5. external call ID/lifecycle observed
6. one verified webhook/event
7. mission/provider/communication correlation resolved
8. transcript/result available
9. normalized `CommunicationResult`

Only then connect quote extraction and full agent continuation.

---

## 2. Kros Voice Runtime Options

### Vapi — first candidate

Kros documents a SIP/BYO-number setup using Kros SIP credentials, a Vapi SIP trunk, Vapi Assistant ID and SIP Trunk Credential ID.

Kros positions Vapi for structured workflows/tool calling/function execution. Test this path first.

### Retell — first fallback

Use if Vapi setup/reliability is poor during the event. Kros documents Retell agent integration and dynamic variables/analysis/transcript support.

### ElevenLabs — second fallback

Supported by Kros as a voice-agent endpoint. Keep it as a fallback rather than another simultaneous dependency.

### LiveKit — advanced path

Kros supports LiveKit as an agent endpoint. This becomes especially useful with Spitch for a custom African-language voice-agent pipeline.

Selection rule:

```text
real phone call
→ useful provider response
→ trustworthy transcript/result
→ valid Quote
```

Choose the fastest repeatable runtime, not the largest sponsor count.

---

## 3. BimpeAI — Agent Brain / Workflow / Knowledge / Tools

### REST API / auth

Official Bimpe docs describe the Console REST API under:

```text
https://api.bimpe.ai/api/v1/console
```

Accepted auth headers include:

```text
Authorization: Bearer sk_...
```

or:

```text
X-Api-Key: sk_...
```

Keys are scope-restricted. `X-Request-Id` can be supplied for correlation.

### SABI role

Use Bimpe for:

- workflow
- agent/system instructions
- curated Knowledge Base
- bounded Custom API tools
- conversations/testing

Do not let Bimpe replace SABI Mission state or directly mutate unrestricted storage.

### Knowledge Base

Current docs support text and URL knowledge sources.

Good KB material:

- trust policy
- approval policy
- procurement rules
- provider communication rules
- category/domain guidance
- fraud/truthfulness rules

Do not store volatile provider price/availability/delivery promises as durable KB knowledge.

### Custom API tools

Bimpe can configure a custom API base URL and register named HTTP tools.

Recommended initial SABI tools:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

All still pass through SABI validation/guardrails.

### Runtime compatibility

The official TypeScript SDK docs currently state `@bimpeai/sdk` runs on Node 24+.

SABI CI currently runs Node 20.

Active hackathon path:

```text
Next.js / Node 20
→ native server-side fetch
→ Bimpe REST API
```

Only install the SDK after an intentional runtime upgrade and successful CI/build/test verification.

---

## 4. Spitch — African Speech / Translation

### Auth

Official APIs use Bearer auth. Keep `SPITCH_API_KEY` server-side.

### STT

Verified endpoint:

```text
POST /v1/transcriptions
```

It returns transcript text plus optional segments/timestamps.

### Translation

Verified endpoint:

```text
POST /v1/translate
```

Documented language codes include:

```text
en  English
yo  Yoruba
ha  Hausa
ig  Igbo
am  Amharic
pcm Nigerian Pidgin
```

### TTS / speech

Spitch documents speech generation with telephony-friendly formats including raw PCM, μ-law and A-law, in addition to common audio formats.

### LiveKit

Spitch publishes an official LiveKit voice-agent integration using Spitch STT/TTS inside `AgentSession`.

Because Kros also supports LiveKit, the advanced path is coherent:

```text
KrosAI number
→ LiveKit SIP
→ LiveKit Agent
→ Spitch STT/TTS
→ SABI/Bimpe tools
```

Use only after the primary phone loop is stable.

---

## 5. YarnGPT — Optional African Voice Enhancement

### Auth

Developer routes under `/api/v1/*` use:

```text
Authorization: Bearer <YARNGPT_API_KEY>
```

Docs state there is no sandbox/test key; calls consume credits.

### Async TTS

```text
POST /api/v1/tts
→ job_id
→ GET /api/v1/status/{job_id}
```

### Low-latency synthesis

YarnGPT also documents a ticket/stream flow and:

```text
POST /api/v1/streaming/conversation
```

which returns audio directly for supplied text. PCM sample rate is not fixed; read it from the response `Content-Type`.

This is low-latency synthesis, not a complete STT→LLM→TTS phone agent by itself.

### STT

```text
POST /api/v1/asr
→ job_id
→ GET /api/v1/asr/{job_id}
```

ASR is asynchronous/polled. Query the live language endpoint/catalog rather than hard-coding capabilities.

### SABI role

Optional uses:

- African TTS
- translated synthesis
- low-latency voice output
- post-call/file transcription

Do not make Yarn ASR the first critical real-time ASR dependency.

---

## 6. Temlio — Optional Communications Fallback

Public material verifies:

- Voice
- SMS
- USSD
- local virtual numbers/DIDs
- REST-style integrations
- business/contact-center communication

Public docs still do not expose enough detail to safely implement:

- base URL
- auth header
- SMS request schema
- delivery receipt model
- inbound SMS webhook
- voice payloads
- sandbox credentials
- rate/retry semantics

Do not invent these.

Preferred first use once partner docs/access arrive:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ provider reply/event
→ CommunicationResult
```

---

## 7. Recommended Integration Order

### Stage A — integrated mock loop

Femi/Lara modules must plug into Xpen Mission Control through shared contracts.

### Stage B — Bimpe seam

Prove:

- workflow/agent exists
- curated Knowledge loaded
- one bounded SABI tool works
- SABI remains system of record

### Stage C — Kros transport

Prove:

- account/KYC/key/number
- live route confirmed
- endpoint attached
- one consented call
- signed webhook/event
- correlation
- transcript/result
- `CommunicationResult`

### Stage D — voice runtime

Try Vapi first. Use one fallback only if necessary.

### Stage E — quote loop

```text
call completed
→ transcript/result
→ structured extraction
→ Quote validation
→ Femi comparison
→ Mission Control
→ human approval
```

### Stage F — multilingual enhancement

Add one language through Spitch/LiveKit only if Stage E is stable.

### Stage G — SMS fallback

Add Temlio only when detailed contracts/access exist.

---

## 8. Environment Variables — Names Only

```text
KROSAI_API_KEY=
KROSAI_BASE_URL=
KROSAI_PHONE_NUMBER=
KROSAI_PHONE_NUMBER_ID=
KROSAI_ENDPOINT_ID=
KROSAI_WEBHOOK_SECRET=

BIMPEAI_API_KEY=
BIMPEAI_BASE_URL=https://api.bimpe.ai/api/v1/console
BIMPEAI_AGENT_ID=
BIMPEAI_WORKFLOW_ID=

VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_SIP_TRUNK_CREDENTIAL_ID=

SPITCH_API_KEY=
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_AGENT_NAME=
LIVEKIT_SIP_TRUNK_ID=
LIVEKIT_SIP_URI=

YARNGPT_API_KEY=
```

Add Temlio variable names only after its contract is known.

---

## 9. Integration Truthfulness Rules

- API acceptance is not action completion.
- `initiated`/`ringing` are not `completed`.
- no-answer/busy/failed remain failure observations.
- a transcript is not automatically a Quote.
- unknown values remain unknown.
- Quote fields must be factual and source-traceable.
- duplicate webhooks must not duplicate Quotes/state transitions.
- secrets never reach client-side code.
- mock/simulated/playground calls are labelled honestly.
- live test calls go only to consenting participants/providers.

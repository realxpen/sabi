# Partner Integrations — Verified Technical Map

Status: ACTIVE
Last verified: 2026-09-30

This file records implementation facts verified from official/public partner documentation. It replaces Phase 0 assumptions where concrete contracts are now available. Where documentation conflicts or a public API contract is unavailable, the uncertainty is recorded explicitly rather than guessed.

## Executive integration rule

Do not put every partner into the same critical path.

For SABI, the preferred separation is:

```text
BimpeAI        = agent workflow / knowledge / tool orchestration
SABI backend   = source of truth for Mission, Provider, Quote, Approval, guardrails
KrosAI         = phone/telephony transport
Voice runtime  = Vapi first OR LiveKit + Spitch for richer African-language voice
Spitch         = African STT/TTS/translation, especially with LiveKit
YarnGPT        = optional African voice/TTS/translation/post-call transcription path
Temlio         = optional SMS/communications fallback when event API docs are provided
```

There is currently no verified public documentation showing a direct BimpeAI ↔ KrosAI native integration. Connect them through SABI-owned tools/APIs or through a supported voice runtime; do not invent a direct provider bridge.

---

## 1. KrosAI — Telephony Transport

### Verified role

KrosAI is the phone-network layer. It bridges AI voice endpoints to real phone numbers and supports local numbers, inbound/outbound calls, call lifecycle events, recordings, transcripts, logs, webhooks, and provider integrations.

For SABI, KrosAI belongs behind the existing `CommunicationAdapter`.

### Account prerequisites

Before live calling:

- KrosAI account
- completed KYC before number provisioning
- KrosAI API key
- KrosAI phone number
- one configured AI endpoint
- a consenting test destination number

Nigeria is listed among supported number markets in the current KrosAI documentation.

### Authentication

Server-side requests use:

```text
x-api-key: <KROSAI_API_KEY>
```

Documented scopes include:

- `numbers:read`
- `numbers:write`
- `endpoints:read`
- `endpoints:write`
- `calls:read`
- `calls:write`
- `webhooks:read`
- `webhooks:write`
- `voice:connect` for Voice SDK use

Use least privilege. Dashboard JWT/Bearer auth is separate; server-side integrations should use API keys.

### Important REST-path inconsistency

KrosAI public docs currently contain inconsistent path examples:

- several integration/quickstart examples use `https://api.krosai.com/v1/...`
- several API-reference guides declare `https://api.krosai.com/api/v1/...`
- the outbound guide describes `POST /outbound-call`, while integration examples use `/outbound-calls`

Therefore SABI must not scatter a hard-coded URL throughout the codebase.

Use a server-side configurable base URL, e.g. `KROSAI_BASE_URL`, and confirm the live route with the dashboard/API Explorer or a minimal successful request before locking the adapter.

### Endpoints

KrosAI endpoint types:

- `agent` — AI voice provider
- `webhook` — custom HTTP endpoint

Current documented agent providers include:

- Vapi
- Retell
- ElevenLabs
- LiveKit

Endpoint records conceptually contain name, type, URL/SIP target, status, and provider configuration.

### Outbound-call contract

Current outbound-call guide documents:

- `from_number` — KrosAI-owned E.164 number
- `to_number` — destination in E.164
- `endpoint_id` — AI endpoint handling the call
- `metadata` — optional correlation/application data
- `webhook_url` — optional per-call override
- `max_duration` — optional safety cap

For SABI, metadata should include correlation fields such as:

```json
{
  "missionId": "mission_123",
  "providerId": "provider_456",
  "correlationId": "communication_789"
}
```

Do not identify a mission only by a phone number when explicit metadata is available.

### Call lifecycle

Documented lifecycle:

```text
initiated → ringing → answered → in_progress → completed
```

Failure outcomes include:

- `failed`
- `no_answer`
- `busy`

Map these into SABI's `CommunicationResult`; do not leak Kros-specific status names across the whole domain.

A request being accepted only means `initiated`, not that a provider answered or supplied a quote.

### Logs, transcript and recording

KrosAI call APIs expose call history, lifecycle events, recordings and transcripts. Current guides describe automatically generated recordings/transcripts for completed calls and a transcript field with speaker labels when available.

SABI should treat the transcript as evidence for quote extraction, not as a Quote by itself:

```text
call completed
→ transcript/result available
→ extract factual fields
→ validate Quote
→ store source reference
→ compare only valid data
```

### Webhooks

The current webhook event guide lists:

- `call.initiated`
- `call.ringing`
- `call.answered`
- `call.completed`
- `call.failed`
- `recording.ready`
- `transcript.ready`

It also documents phone-number, endpoint, port-request and billing event categories.

Webhook envelope fields include:

- `id` — unique event identifier
- `event`
- `created_at`
- `data`

The docs instruct verification of `X-Webhook-Signature` and require a `2xx` response within 10 seconds. Failed deliveries are retried, so webhook processing must be idempotent; store/process event IDs safely before state mutation where practical.

### Webhook documentation-version warning

Older KrosAI pages/examples use names such as `call.started`, `call.ended`, `call.recording.completed`, or `transcription.completed`, while the current event index uses the newer names above.

Do not code the handler around one old sample. Confirm the event list/payload in the live dashboard/API Explorer and implement provider-event mapping in one adapter module.

### Simulated inbound calls

KrosAI's current API index documents an authenticated simulated-inbound-call endpoint for realistic test scenarios. The exact public request schema was not reliably retrievable in this audit.

Use the live API Explorer for the payload before implementing it. Do not invent fields from the endpoint name.

### Rate limits

KrosAI publishes plan-level and endpoint-specific rate limits and rate-limit headers. Because the public docs contain at least one concurrency discrepancy between plan tables and the outbound guide, SABI should read live response headers/dashboard limits rather than relying on hard-coded plan assumptions.

Handle `429` and `Retry-After` with bounded backoff.

---

## 2. KrosAI Voice Runtime Options

SABI needs one voice runtime behind KrosAI; integrating all of them creates needless risk.

### Option A — Vapi: fastest structured-agent path

Verified KrosAI setup requires:

1. Vapi account and assistant
2. configure a SIP trunk in Vapi using KrosAI number SIP credentials
3. import the KrosAI number as a BYO SIP-trunk number
4. obtain the Vapi Assistant ID
5. connect Vapi credentials in KrosAI
6. create a KrosAI Vapi endpoint using the Assistant ID and Vapi SIP Trunk Credential ID
7. attach the endpoint to the KrosAI number

KrosAI positions Vapi for structured workflows, tool calling and function execution.

**Hackathon recommendation:** test this path first because it is the lowest-complexity route to `mission → phone call → agent conversation → result`.

### Option B — Retell

Verified requirements:

- Retell account + agent
- Retell API key
- Retell agent ID
- KrosAI number
- KrosAI endpoint with `provider: retell`

Retell dynamic variables can be passed through KrosAI call metadata. KrosAI's example completion payload includes transcript and call analysis.

Use as fallback if its event setup proves more reliable than Vapi during the event.

### Option C — ElevenLabs

Verified KrosAI guide requires:

- ElevenLabs Conversational AI / ElevenAgents agent
- import KrosAI phone number through SIP trunk credentials
- ElevenLabs Agent ID
- KrosAI ElevenLabs endpoint

This is a strong natural-voice option, but SABI should not choose it solely for voice quality if tool/action integration becomes slower.

### Option D — LiveKit

Verified KrosAI guide requires:

- LiveKit Cloud or self-hosted instance
- running LiveKit agent
- configured LiveKit SIP trunk
- LiveKit API key
- LiveKit API secret
- LiveKit WebSocket server URL
- LiveKit agent name/ID
- SIP trunk ID
- SIP URI

KrosAI provider config includes the LiveKit agent name, SIP trunk ID and SIP URI. Agent verification occurs at call-time because LiveKit agents are worker processes.

This is the most coherent route if SABI wants direct control of the real-time voice pipeline and Spitch African-language STT/TTS, but it has more moving parts than Vapi.

---

## 3. Spitch — African Speech + Live Voice Layer

### Authentication and SDK

Spitch supports TypeScript/Python SDKs and Bearer API auth. Keep `SPITCH_API_KEY` server-side.

### TTS

Verified REST endpoint:

```text
POST https://api.spitch.app/v1/speech
```

Current docs list production-ready voices across English, Hausa, Igbo, Yoruba, Amharic and Nigerian Pidgin.

Supported output formats include:

- `wav`
- `mp3`
- `ogg_opus`
- `webm_opus`
- `flac`
- `pcm_s16le`
- `mulaw`
- `alaw`

Raw PCM/μ-law/A-law make Spitch useful for telephony pipelines where unnecessary decode/re-encode steps should be avoided.

### STT

The current SDK exposes `speech.transcribe` with:

- audio bytes/file/public URL/Spitch file UUID
- optional language code such as `en`, `yo`, `ha`, `ig`, `am`
- optional special words
- optional sentence/word timestamps

Current docs recommend omitting the deprecated `model` parameter for new integrations.

### Translation

Verified REST endpoint:

```text
POST https://api.spitch.app/v1/translate
```

It accepts text, target language, optional source language, tone and formality. Source language can be auto-detected.

### LiveKit integration

Spitch publishes an official LiveKit integration for real-time voice agents.

Prerequisites:

- Python 3.10+
- Spitch API key
- LiveKit API key
- LiveKit API secret
- LiveKit URL

Installation:

```text
pip install "livekit-agents[spitch]~=1.2.0"
```

The integration exposes Spitch STT and TTS plugins inside a LiveKit `AgentSession`.

Therefore a technically coherent SABI multilingual stack is:

```text
KrosAI number
→ LiveKit SIP
→ LiveKit voice agent
→ Spitch STT
→ LLM/SABI tools
→ Spitch TTS
→ provider phone
```

Do not make this the first integration unless the simple phone loop already works.

---

## 4. YarnGPT — African Voice API

### Authentication

Developer routes under `/api/v1/*` use:

```text
Authorization: Bearer <YARNGPT_API_KEY>
```

YarnGPT states there is no sandbox/test key; calls consume credits.

### TTS job flow

```text
POST /api/v1/tts
GET  /api/v1/status/{job_id}
```

The TTS job route is asynchronous and requires an `Idempotency-Key`. There is no webhook/callback for job completion; polling is required.

### Low-latency streaming TTS

YarnGPT supports a ticket flow:

```text
POST /api/v1/tts/prepare
GET  /api/v1/tts/stream/{ticket}
```

Voice IDs are dynamic; query the voice catalog rather than hard-coding one.

### Single-turn conversation audio

```text
POST /api/v1/streaming/conversation
```

This returns synthesized audio directly for supplied text. Formats include PCM, WAV and MP3. For PCM, read the sample rate from the response `Content-Type`; it is not fixed.

Important architectural distinction: this route is low-latency response synthesis, not a complete phone voice-agent loop by itself.

### STT

```text
POST /api/v1/asr
GET  /api/v1/asr/{job_id}
GET  /api/v1/asr/languages
```

ASR uses an asynchronous file-job/polling pattern and requires an `Idempotency-Key` for upload.

### SABI role

YarnGPT is useful for:

- African voice synthesis
- translated voice output
- post-call/file transcription
- optional demo voice enhancement

It is less convenient than Spitch + LiveKit as the critical real-time phone ASR loop because its documented ASR flow is asynchronous.

---

## 5. Temlio — Communications / Fallback Layer

Temlio's public site verifies capabilities including:

- Voice
- SMS
- USSD RESTful API integration
- local virtual numbers (DIDs)
- business phone communication
- contact-center services
- automated SMS/voice campaigns
- IVR and interactive engagement

### Public-doc boundary

No sufficiently detailed public API reference was found during this audit for:

- base URL
- authentication headers
- SMS request schema
- delivery receipts
- inbound reply webhooks
- voice payloads
- rate limits
- sandbox/test credentials

Therefore **do not implement a Temlio live adapter from guesses**.

When event access arrives, ask for those exact contracts. The planned SABI role is optional fallback, e.g.:

```text
KrosAI no_answer / busy / failed
→ Temlio SMS fallback
→ provider response
→ normalized CommunicationResult
```

This plan becomes ACTIVE implementation only after the API contract is verified.

---

## 6. BimpeAI — Agent Workflow / Knowledge / Tool Orchestration

BimpeAI was listed in the hackathon material and now has public developer documentation. It materially clarifies SABI's agent layer.

### API and auth

Console REST API base:

```text
https://api.bimpe.ai/api/v1/console
```

Accepted secret-key headers:

```text
Authorization: Bearer sk_...
```

or:

```text
X-Api-Key: sk_...
```

Keys are scope-restricted. Bimpe also supports `X-Request-Id` correlation.

### TypeScript SDK compatibility warning

Official BimpeAI TypeScript SDK documentation currently states that `@bimpeai/sdk` runs on Node 24+ (along with Bun/Deno/modern edge runtimes).

SABI's current GitHub CI uses Node 20.

Therefore we must choose deliberately:

- **hackathon-safe option:** keep Node 20 and use Bimpe's REST API through native `fetch`, or
- upgrade runtime/CI to Node 24 and verify the entire Next.js build before using the SDK.

Do not install the SDK and discover an engine/runtime conflict on demo day.

### Workflows and agents

Bimpe workflows define the agent's system prompt/rules/flows. Agents bind to workflows and can be created/managed via API/SDK.

For SABI, Bimpe should not own Mission truth. It should reason over mission context and call safe SABI tools.

### Knowledge bases

Current Bimpe docs support knowledge bases created from:

- `text`
- `url`

File uploads are documented as coming later.

This is a direct fit for SABI's LLM knowledge layer. Good content includes:

- approval policy
- trust policy
- procurement rules
- communication rules
- category/domain guidance

Do **not** store current vendor price/availability as durable knowledge; those are live operational facts.

### Custom API tools

Bimpe supports custom HTTP API integrations. The documented pattern is:

1. configure a custom API with a `base_url`
2. add named tools with HTTP method + URL template
3. let the agent call those bounded tools

For SABI this maps naturally to safe server endpoints such as:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

Do not expose unrestricted database mutation as a tool.

### Channels and telephony

Bimpe supports channels such as webchat, WhatsApp and telephony. Channel connections are configured in the Console Deploy screen; the SDK can list them but does not create channel connections.

Bimpe also documents outbound telephony via `calls.make`, including `is_test_call: true` for test telephony and `false` for live configured telephony.

This means Bimpe has its own telephony path. However, no official public documentation found in this audit states that Bimpe's telephony is natively backed by KrosAI.

For this hackathon, do not run two competing critical telephony stacks. If KrosAI is selected as the partner phone transport, use Bimpe primarily as brain/knowledge/tool orchestration and keep call transport inside the SABI communication adapter.

### Conversation caution

Bimpe's quickstart says conversations are customer-driven through connected channels; its conversation API is not intended as a generic cold-outreach mechanism.

Provider cold/outbound calls should therefore go through a documented outbound-call mechanism (KrosAI or Bimpe telephony if intentionally selected), not by abusing a Bimpe conversation endpoint.

---

## 7. Recommended SABI Hackathon Stack

### Recommended first path — reliability

```text
User
→ SABI Next.js Mission API
→ BimpeAI workflow + Knowledge Base (agent brain)
→ bounded SABI tools
→ callProvider()
→ KrosAI
→ Vapi voice runtime
→ provider phone
→ KrosAI lifecycle/transcript/webhook
→ CommunicationResult
→ validated Quote
→ Femi filtering/ranking
→ Mission Control
→ HUMAN APPROVAL
```

Why this is first:

- preserves SABI as system of record
- uses Bimpe for knowledge/tool orchestration
- uses Kros for its strongest role: telephony
- uses Vapi where Kros explicitly positions structured workflows/tool calling
- minimizes custom real-time audio plumbing

### Advanced multilingual path

After the English phone loop works:

```text
KrosAI
→ LiveKit SIP
→ LiveKit agent
→ Spitch STT/TTS
→ SABI/Bimpe tools
```

Use exactly one African-language demo first, e.g. Yoruba or Nigerian Pidgin if the verified runtime supports the desired flow.

### Optional layers

- YarnGPT: African TTS/translation/post-call STT or standalone voice enhancement
- Temlio: SMS fallback after official event API docs/access
- Retell: voice-runtime fallback if Vapi setup fails
- ElevenLabs: alternate natural-voice runtime if it improves reliability without slowing integration

---

## 8. Required Environment Configuration

Never commit values. The following are SABI project variable conventions unless the provider itself defines the name.

```text
# KrosAI
KROSAI_API_KEY=
KROSAI_BASE_URL=
KROSAI_PHONE_NUMBER=
KROSAI_PHONE_NUMBER_ID=
KROSAI_ENDPOINT_ID=
KROSAI_WEBHOOK_SECRET=

# BimpeAI
BIMPEAI_API_KEY=
BIMPEAI_AGENT_ID=
BIMPEAI_WORKFLOW_ID=

# Vapi fast path
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_SIP_TRUNK_CREDENTIAL_ID=

# LiveKit + Spitch path
LIVEKIT_URL=
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_AGENT_NAME=
LIVEKIT_SIP_TRUNK_ID=
LIVEKIT_SIP_URI=
SPITCH_API_KEY=

# Optional YarnGPT
YARNGPT_API_KEY=

# Temlio — add actual project variables only after partner API docs/access
# TEMLIO_API_KEY=
```

---

## 9. Correct Build Order

1. Prove KrosAI account/KYC/API key/phone number.
2. Make one consented test call through the selected Kros endpoint.
3. Build/verify webhook receiver, signature verification and idempotency.
4. Correlate `missionId + providerId + communicationId` through metadata.
5. Retrieve/use the completed call transcript/result.
6. Normalize factual response to `CommunicationResult` and then a validated Quote.
7. Let Femi's module filter/rank; show result in Xpen's Mission Control.
8. Stop at human approval.
9. Add Bimpe workflow + SABI knowledge base + bounded custom API tools.
10. Add one multilingual enhancement only after the base loop works.
11. Add Temlio SMS fallback only after its API contract is provided.
12. Freeze the demo and test failure paths.

---

## 10. Integration Truthfulness Rules

- API acceptance is not a successful phone conversation.
- `initiated` is not `answered` or `completed`.
- no-answer/busy/failed events never create a fake Quote.
- a transcript is evidence, not automatically a Quote.
- missing delivery fee is not assumed to be zero.
- missing price/availability stays unknown.
- duplicate webhooks must not duplicate Quotes or state transitions.
- all provider facts remain traceable to a call/message/source reference.
- secrets remain server-side.
- simulated calls, playground calls, and mock fixtures must be labelled accurately.
- no purchase/payment/booking occurs without explicit human approval.

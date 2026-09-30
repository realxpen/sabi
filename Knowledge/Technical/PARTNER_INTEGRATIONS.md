# Partner Integrations — Verified Technical Map

Status: ACTIVE
Last verified: 2026-09-30

This file records implementation facts verified from official partner documentation. It replaces Phase 0 assumptions where the docs now provide concrete contracts.

## 1. KrosAI — Telephony Layer

### Verified role

KrosAI provides AI-native phone infrastructure. It connects local phone numbers to AI endpoints and supports inbound/outbound calling, call logs, recordings/transcripts, webhooks, and provider integrations.

For SABI, KrosAI belongs behind the communication adapter and is responsible for the real phone-call transport.

### Account / phone-number prerequisites

The quickstart requires:

- KrosAI account
- KYC before purchasing phone numbers
- KrosAI API key
- a KrosAI phone number
- an AI endpoint/provider

Useful API-key scopes include:

- `numbers:read`
- `numbers:write`
- `calls:read`
- `calls:write`
- `endpoints:read`
- `endpoints:write`
- `webhooks:read`
- `webhooks:write`

The quickstart examples authenticate with:

`x-api-key: <KROSAI_API_KEY>`

Keep the key server-side.

### AI endpoints

KrosAI can route calls to:

- Vapi
- ElevenLabs
- Retell
- LiveKit
- custom webhook/server endpoints

An endpoint conceptually contains:

- name
- type (`agent` or `webhook`)
- URL / SIP target
- provider-specific configuration

The KrosAI number is then attached to that endpoint and inbound/outbound calling can be enabled.

### Outbound-call model

Verified request fields include:

- `from_number` — KrosAI-owned number in E.164 format
- `to_number` — destination in E.164 format
- `endpoint_id` — AI endpoint to handle the call
- `metadata` — optional
- `webhook_url` — optional override in the outbound-call reference
- `max_duration` — optional in the outbound-call reference

For SABI, metadata should carry correlation identifiers where the live API accepts them, for example:

```json
{
  "missionId": "mission_123",
  "providerId": "provider_456"
}
```

That lets Lara resolve incoming call events back to the correct Mission and Provider without inferring identity from phone numbers.

### Call lifecycle

The outbound-call docs describe:

`initiated → ringing → answered → in_progress → completed`

Failure outcomes include:

- `failed`
- `no_answer`
- `busy`

SABI should normalize these into the existing `CommunicationResult` states rather than leaking KrosAI-specific statuses throughout the domain.

### Webhooks

Verified KrosAI webhook events include:

- `call.started`
- `call.ended`
- `call.failed`
- `call.recording.completed`
- `transcription.completed`

The webhook documentation shows event IDs plus call data and a signing secret.

Signature verification is based on `X-Webhook-Signature` using HMAC-SHA256 over the raw payload with the webhook secret.

The webhook retry policy shown in the docs retries failed delivery multiple times, so SABI webhook processing must be idempotent.

Store the provider event ID before applying consequential state transitions when practical.

### Call records

KrosAI call logs expose call history and detail, including filtering by status/direction/phone number/endpoint. This can serve as an audit/recovery source if a webhook is missed.

### Important documentation conflict

Do not hard-code the final outbound-call URL from memory yet.

Official KrosAI documentation currently contains inconsistent examples:

- Quickstart examples use paths such as `https://api.krosai.com/v1/outbound-calls`.
- Another outbound-call reference presents a base under `https://api.krosai.com/api/v1/outbound-calls` and also describes `POST /outbound-call`.

Before Lara implements the live adapter, confirm the current path using the live API explorer/dashboard or a successful minimal test call.

Record the confirmed route in this file afterward.

### Best first SABI test

Do not begin with the full agent loop.

First prove:

1. valid API key
2. access to a KrosAI phone number
3. endpoint exists
4. initiate one test outbound call
5. receive one webhook/call event
6. correlate it using mission/provider metadata
7. store the normalized `CommunicationResult`

Only then connect quote extraction and the agent continuation loop.

---

## 2. KrosAI Voice-Agent Provider Options

### Vapi

KrosAI documents a Vapi integration using SIP/BYO-number setup and a Vapi Assistant ID.

KrosAI positions Vapi around structured workflows/tool calling/function execution. That makes Vapi a strong candidate for the hackathon if the team wants the phone conversation itself to invoke SABI tools.

Do not select it solely from this description; test actual setup/latency and available event credits first.

### Retell

KrosAI documents Retell endpoints using a Retell agent ID and provider configuration. Their example shows dynamic variables passed through outbound-call metadata and call-completion data including transcripts/analysis.

Retell is another viable path if its setup proves faster or more reliable during the event.

### ElevenLabs

KrosAI supports ElevenLabs agent endpoints and describes it primarily around natural conversation/voice quality.

The currently supplied ElevenLabs integration link should be treated as official source material, but the page was not reliably retrievable during this verification pass. Do not invent missing setup fields.

### Selection rule

For the hackathon, choose the provider that gives the fastest reliable end-to-end loop:

`SABI mission → callProvider → real phone → useful response → webhook/transcript → Quote`

Do not integrate all three voice platforms.

---

## 3. Temlio — Voice / SMS / USSD / Local Numbers

### Verified role

Temlio's public site confirms cloud communication capabilities including:

- Voice
- SMS
- USSD
- RESTful API integration
- business phone communication
- contact-center solutions
- local virtual numbers (DIDs)
- automated SMS/voice campaigns

### Current documentation boundary

The provided Temlio homepage does not expose enough detailed API-contract information to safely implement request payloads, auth headers, webhooks, or status values from the public page alone.

Therefore:

- keep the Temlio adapter interface ready
- do not invent API fields
- obtain partner API documentation/credentials from the event team or Temlio
- use Temlio first as SMS fallback if its event API is faster to integrate than a second voice transport

A likely SABI role is:

`KrosAI call fails/no answer → Temlio SMS fallback → provider replies / alternate flow`

but this remains a product/integration plan until the actual API contract is verified.

---

## 4. YarnGPT — African Voice API

### Authentication

Developer routes under `/api/v1/*` use:

`Authorization: Bearer <YARNGPT_API_KEY>`

YarnGPT explicitly states there is no sandbox/test key; API calls spend real credits.

Store the key server-side and use short test utterances.

### Text-to-Speech

Async TTS:

`POST /api/v1/tts`

returns a `job_id` and requires an `Idempotency-Key`.

Poll:

`GET /api/v1/status/{job_id}`

until complete.

There is no webhook/callback for the async TTS job, so polling is required.

Do not build the live SABI phone loop around async TTS unless needed.

### Real-time single-turn conversation audio

For live voice use, YarnGPT exposes:

`POST /api/v1/streaming/conversation`

It returns audio directly and supports:

- `pcm`
- `wav`
- `mp3`

For a telephony/audio pipeline, the docs specifically recommend `pcm` to avoid a decode step.

Important: PCM sample rate is not fixed. Read the rate from the response `Content-Type` rather than hard-coding one.

An optional `Idempotency-Key` is useful to prevent uncertain retries from charging twice.

### Speech-to-Text

Upload:

`POST /api/v1/asr`

with multipart audio and an `Idempotency-Key`, then poll:

`GET /api/v1/asr/{job_id}`

for transcription status/result.

### Language caution

YarnGPT's public API supports multiple translation target-language codes including Yoruba (`yo`), Hausa (`ha`) and Igbo (`ig`).

Do not assume that every language/voice mentioned in event marketing maps directly to a `target_language` value. Query the live API/voice catalog and ASR-language endpoint rather than hard-coding capabilities.

### SABI use

Potential roles:

- synthesize SABI's provider-facing speech
- translate/synthesize a response into a supported language
- transcribe recorded/provider audio when a live voice platform does not already provide a usable transcript

For the hackathon, only add YarnGPT to the real call path if the audio plumbing can be demonstrated reliably.

---

## 5. Spitch — African Speech / Translation Layer

### Authentication / SDK

Official docs support a JavaScript/TypeScript SDK and Bearer API authentication.

Keep `SPITCH_API_KEY` server-side.

### Speech-to-Text

Verified endpoint:

`POST /v1/transcriptions`

The STT API accepts audio content and optionally a language code. The response includes:

- `request_id`
- `text`
- optional segments/timestamps

### Translation

Verified endpoint:

`POST /v1/translate`

The docs list language codes including:

- English `en`
- Yoruba `yo`
- Hausa `ha`
- Igbo `ig`
- Amharic `am`
- Nigerian Pidgin `pcm`

### Text-to-Speech

Verified speech generation endpoint:

`POST https://api.spitch.app/v1/speech`

The API supports streamed speech generation and formats including:

- wav
- mp3
- OGG/Opus
- WebM/Opus
- FLAC
- raw PCM 16-bit little-endian
- μ-law
- A-law

The docs explicitly list production-ready voices across English, Hausa, Igbo, Yoruba, Amharic and Nigerian Pidgin.

This is especially useful for telephony because raw PCM / μ-law / A-law formats reduce conversion work depending on the transport used.

### LiveKit

Spitch has an official LiveKit integration for STT/TTS voice agents.

KrosAI also lists LiveKit among supported AI-agent connection options, so a technically coherent advanced path is:

`KrosAI phone number → LiveKit agent → Spitch STT/TTS → SABI LLM/tools`

However, this adds another moving part. Use it only if the basic KrosAI + chosen voice-agent provider path is already stable or the partner team explicitly recommends it.

---

## 6. Recommended Hackathon Integration Order

### Stage A — prove telephony transport

Lara:

1. create/confirm KrosAI account and KYC
2. create restricted API key
3. obtain event/test phone number
4. create one AI endpoint
5. attach endpoint to number
6. initiate one consented test call
7. observe lifecycle/events
8. receive/verify one webhook

### Stage B — bind calls to SABI

Use KrosAI metadata/correlation data so:

`missionId + providerId → externalCallId`

Store it in SABI communication state.

### Stage C — normalize result

Convert KrosAI/provider result to:

`CommunicationResult`

Then produce a Quote only when factual provider data exists.

### Stage D — close the loop

`call completed → transcript/result → structured quote → Femi comparison → Xpen Mission Control → human approval`

### Stage E — African-language enhancement

Once the English call loop works, add exactly one reliable language demonstration with YarnGPT or Spitch.

Do not make multilingual integration block the core demo.

### Stage F — SMS fallback

If Temlio API access is provided and straightforward, add SMS for no-answer/failure recovery.

---

## 7. Environment Variables — Names Only

Do not commit values.

Likely server-side names:

```text
KROSAI_API_KEY=
KROSAI_PHONE_NUMBER=
KROSAI_ENDPOINT_ID=
KROSAI_WEBHOOK_SECRET=

YARNGPT_API_KEY=
SPITCH_API_KEY=

# Add only after verified documentation/access:
TEMLIO_API_KEY=

# Depending on selected KrosAI voice provider:
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
RETELL_API_KEY=
RETELL_AGENT_ID=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
```

Only include variables actually used by the selected integration.

---

## 8. Integration Truthfulness Rules

- A call is not successful just because the API accepted the request.
- `initiated` is not `completed`.
- No-answer/busy/failed must stay failure observations.
- A transcript does not automatically equal a valid Quote.
- Quote extraction must validate availability/price/delivery fields before recommendation.
- Provider results must stay traceable to their external call/message source.
- Webhook duplicates must not create duplicate Quotes or duplicate state transitions.
- External partner secrets never reach client-side code.
- Do not present simulated inbound calls, mock fixtures, or playground calls as live provider conversations without labelling them accurately.

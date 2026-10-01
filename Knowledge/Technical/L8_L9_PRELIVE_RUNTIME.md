# Lara L8/L9 Pre-Live Runtime

Status: IMPLEMENTED IN CODE / EXTERNAL PROOF PENDING
Last updated: 2026-10-01

This note is the current implementation authority for Lara L8 (African-language voice enhancement) and L9 (Temlio messaging fallback). It supersedes the older "Temlio contract unavailable" note in `PARTNER_INTEGRATIONS.md`: current Voicebip documentation now exposes an implementation-grade messaging and webhook contract.

## L8 — Spitch + LiveKit African-language path

Implemented code:

- `lib/integrations/voice-runtime/spitch.ts`
- `lib/integrations/voice-runtime/livekit-spitch.ts`
- `tests/spitch-livekit.test.ts`

Verified Spitch primitives implemented behind server-side Bearer auth:

- translation: `POST /v1/translate`
- transcription: `POST /v1/transcriptions`
- speech generation: `POST /v1/speech`
- explicit language set used by SABI: English (`en`), Yoruba (`yo`), Hausa (`ha`), Igbo (`ig`), Amharic (`am`), Nigerian Pidgin (`pcm`)
- telephony-friendly speech formats include `mulaw`, `alaw` and `pcm_s16le`

The Spitch base URL is configurable with `SPITCH_API_BASE_URL`; the current documented default is `https://api.spitch.app`.

LiveKit/Spitch is deliberately disabled unless:

```text
SABI_AFRICAN_VOICE_MODE=livekit-spitch
```

Readiness requires:

```text
SPITCH_API_KEY
LIVEKIT_URL
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_AGENT_NAME
LIVEKIT_SIP_TRUNK_ID
```

The Next.js backend does not pretend to be the long-running media worker. Spitch's documented LiveKit integration runs inside a LiveKit Agent process. The actual external agent deployment, SIP attachment, media session and one African-language phone conversation remain live proof steps.

No L8 code places a phone call.

## L9 — Voicebip / Temlio Communications SMS fallback

Current Voicebip documentation identifies the API product as part of Temlio Communications infrastructure and now exposes the concrete messaging contract needed for a safe implementation.

Implemented code:

- `lib/integrations/communication/voicebip-message.ts`
- `lib/integrations/communication/message-runtime.ts`
- `lib/integrations/communication/voicebip-webhook-handler.ts`
- `lib/repositories/communication-correlation-repository.ts`
- `lib/integrations/neon/communication-correlation-repository.ts`
- `app/api/agent-tools/send-message/route.ts`
- `app/api/webhooks/voicebip/route.ts`
- `db/neon/communication-correlations.sql`
- fixture/regression tests for send, webhook auth, replay protection, correlation, failure and dedupe

Runtime is disabled unless:

```text
SABI_MESSAGE_MODE=voicebip-temlio
```

Required provider configuration:

```text
VOICEBIP_API_BASE_URL=https://api.voicebip.com/v1
VOICEBIP_API_KEY
VOICEBIP_AGENT_ID
VOICEBIP_SMS_FROM_NUMBER
VOICEBIP_WEBHOOK_SIGNING_SECRET
```

Optional secret-rotation support:

```text
VOICEBIP_WEBHOOK_SIGNING_SECRET_PREVIOUS
```

Message destinations require a separate explicit consent map:

```text
SABI_CONSENTED_PROVIDER_MESSAGE_PHONES_JSON
```

Call consent does not imply SMS consent.

### Outbound contract

SABI uses the documented:

```text
POST /v1/messages
```

with:

```text
agent_id
channel=sms
from_number
to_number
body
```

A provider `message_id` is treated as an external correlation ID. API acceptance means only `INITIATED` unless the provider response explicitly reports a terminal status.

### Durable correlation and duplicate-send protection

Before a network send, SABI persists the canonical Mission/Provider/Communication relationship in `communication_correlations`.

If the same `communicationId` is invoked again:

- an already correlated external message is not resent
- an ambiguous previous attempt without an external ID is not retried automatically

This avoids accidental duplicate SMS sends.

`db/neon/communication-correlations.sql` is prepared but must be applied to the intended Neon branch before enabling live/sandbox messaging. The schema is intentionally not mutated automatically from application code.

### Webhook security

Endpoint:

```text
POST /api/webhooks/voicebip
```

Verification follows the documented Voicebip scheme:

```text
signed_payload = "{unix_timestamp}.{raw_body}"
signature = HMAC-SHA256(signing_secret, signed_payload)
header = X-Voicebip-Signature: sha256=<hex>
```

The handler also:

- rejects timestamps outside the five-minute replay window
- requires `X-Voicebip-Event-ID` to match the JSON `event_id`
- supports the documented previous-signature rotation header
- rejects/ignores events from an unexpected agent
- looks up the external `message_id` before claiming the event
- deduplicates accepted events through Neon `communication_event_claims`
- releases a claim if normalization fails so a valid provider retry can recover

Supported outbound lifecycle events:

```text
message.sent       -> INITIATED
message.delivered  -> COMPLETED
message.read       -> COMPLETED
message.dlr        -> COMPLETED only for DELIVRD; otherwise FAILED
message.failed     -> FAILED
message.send_failed -> FAILED
```

Inbound/unsupported events are not silently converted into Mission state.

A messaging event never creates a Quote. `observation` remains absent and webhook responses explicitly report `quoteCreated: false`.

## Sandbox proof before live SMS

Voicebip documents `pk_test_` sandbox API keys, synthetic SMS lifecycle events and `POST /v1/webhooks/test`, so L9 can be integration-tested without sending an MNO message or incurring live delivery.

The next safe proof sequence is:

1. apply `db/neon/communication-correlations.sql` to the Preview Neon branch
2. configure Preview-only Voicebip sandbox values
3. keep `SABI_MESSAGE_MODE=disabled` until the values and table are verified
4. switch Preview to `voicebip-temlio`
5. use a sandbox `+234800000xxxx` destination
6. verify outbound API acceptance and stored external correlation
7. use Voicebip webhook testing / synthetic lifecycle
8. verify HMAC, dedupe, correlation and canonical `CommunicationResult`
9. switch back to disabled if live messaging is not needed

No real SMS is required for this proof.

## Preview readiness

`GET /api/internal/runtime-status` remains Preview-only and never exposes credentials or phone numbers.

It now reports:

- existing database/Bimpe/Vapi readiness
- L8 mode and Spitch/LiveKit configuration presence
- L9 mode and Voicebip configuration presence
- whether the new correlation table exists
- number of consented SMS destinations
- whether the messaging gate is actually ready

## Remaining external blocks

L8 live proof:

- Spitch account/key
- LiveKit project/key/secret
- deployed LiveKit Agent worker
- LiveKit SIP trunk connected to the intended Kros transport
- one consented African-language call

L9 live proof:

- Voicebip/Temlio account/access
- API key and SMS-capable sender number
- signing secret/webhook registration
- Preview correlation-table migration
- sandbox proof first
- real SMS proof only if the team explicitly chooses to test live messaging

These blocks do not change SABI's human-approval boundary. Messaging and multilingual voice may collect communication evidence; they do not select providers, purchase, book, pay or release funds.

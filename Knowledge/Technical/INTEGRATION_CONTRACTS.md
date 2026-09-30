# SABI Integration & Tool Contracts

Status: ACTIVE
Last verified: 2026-09-30

Partner-independent contracts below are binding. Partner-specific details are implemented only from verified official documentation/live account behavior and stay behind adapters.

## Agent tool principle

The agent receives narrow tools, not unrestricted backend/database access.

## searchProviders

Purpose: return candidate providers matching basic criteria.

```ts
searchProviders({
  category,
  item?,
  location?,
  verifiedOnly?
})
```

Return provider IDs plus only the facts required for planning/matching.

## getProvider

```ts
getProvider({ providerId })
```

## callProvider

Purpose: initiate a bounded real-world provider conversation.

```ts
callProvider({
  missionId,
  providerId,
  objective,
  communicationId
})
```

Immediate success means **contact initiation accepted**, not that the call completed or a Quote exists.

The adapter should return a structured initiation result such as:

```ts
{
  communicationId,
  externalId,
  status: "INITIATED",
  provider: "KROSAI"
}
```

When supported by the live transport, send correlation metadata including `missionId`, `providerId`, and `communicationId`.

## sendMessage

Fallback/alternate channel:

```ts
sendMessage({
  missionId,
  providerId,
  communicationId,
  message
})
```

Temlio is the planned SMS fallback only after its detailed API contract is supplied/verified.

## recordQuote

```ts
recordQuote({
  missionId,
  providerId,
  available,
  price?,
  deliveryFee?,
  total?,
  deliveryDate?,
  notes?,
  source,
  sourceReference?
})
```

Rules:

- validate input
- unknown remains unknown
- do not assume missing delivery fee is zero
- unavailable/no-answer calls do not create fabricated totals
- preserve source reference back to transcript/call/message

## compareQuotes

```ts
compareQuotes({ missionId })
```

Flow:

1. load validated Mission + Quotes
2. apply hard constraints
3. rank only qualifying options
4. return explanation-ready factors
5. preserve excluded options + reasons in logs/state

## requestApproval

```ts
requestApproval({
  missionId,
  quoteId,
  providerId
})
```

Creates a pending approval. It does not purchase, book, transfer, release funds, or otherwise commit the user.

## BimpeAI tool boundary

BimpeAI may call safe SABI HTTP tools through its Custom API integration.

Recommended initial tool set:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

Bimpe receives curated Knowledge + tool results; it does not directly mutate Mission tables.

Use Bimpe REST/native server `fetch` first under the current Node 20 runtime. Do not install the Node-24+ TS SDK unless the runtime migration is intentional and verified.

## Communication adapter contract

All transports implement/extend one domain boundary.

Conceptual interface:

```ts
interface CommunicationAdapter {
  initiateContact(input: ContactProviderInput): Promise<CommunicationResult>;
  normalizeEvent(payload: unknown): Promise<CommunicationResult>;
}
```

Partner-specific status/event values are normalized before Mission logic sees them.

## KrosAI transport mapping

KrosAI is the primary telephony transport.

Verified outbound concepts include:

```text
from_number
to_number
endpoint_id
metadata            optional
webhook_url         optional
max_duration        optional
```

Use E.164 numbers.

Kros official docs currently conflict on exact base/path examples. Therefore:

- configure `KROSAI_BASE_URL`
- keep routes in one adapter module
- verify the current live route via API Explorer/dashboard/minimal test
- never scatter hard-coded Kros URLs throughout SABI

Normalize Kros lifecycle/failure outcomes into existing SABI communication states. Do not equate accepted/initiated/ringing with completed.

## Kros webhook contract

Target route:

```text
POST /api/webhooks/krosai
```

Handler responsibilities:

1. read/preserve raw request body
2. verify `X-Webhook-Signature` using the current official/live contract
3. validate envelope/data
4. deduplicate provider event ID
5. resolve external call → mission/provider/communication
6. map partner event/status into `CommunicationResult`
7. respond 2xx promptly for valid events
8. persist/queue heavier transcript and quote processing where practical
9. never duplicate Quote/state transitions on retry
10. log request/event IDs without secrets

Official Kros pages currently show more than one event naming convention. Keep aliases/version differences inside the Kros adapter and confirm the live dashboard schema before demo freeze.

## Transcript/result → Quote boundary

A transcript is evidence, not automatically a Quote.

Flow:

```text
provider transcript/result
→ structured extraction
→ schema validation
→ required fact checks
→ Quote or incomplete observation
```

Only create a Quote when factual provider values exist. Missing information may trigger follow-up or remain unknown.

## Voice runtime

Primary candidate:

```text
KrosAI → Vapi
```

Fallback if Vapi cannot be made reliable quickly:

1. Retell
2. ElevenLabs

Voice runtime choices stay behind Kros/SABI adapters and do not alter Mission contracts.

## African-language layer

Only after the base call loop works.

Preferred advanced path:

```text
KrosAI → LiveKit SIP → LiveKit Agent → Spitch STT/TTS → SABI/Bimpe tools
```

Spitch can also be called directly for STT/translation/TTS where useful.

YarnGPT is optional for TTS, translated synthesis, low-latency single-turn audio, or asynchronous file/post-call STT. Read live voice/language catalogs rather than hard-coding unsupported values.

## Temlio boundary

Planned first use:

```text
Kros no_answer / busy / failed
→ Temlio SMS
→ provider reply/event
→ CommunicationResult
```

Do not implement request/auth/webhook payloads until detailed Temlio partner docs/live access are available.

## Secrets

Never commit:

- API keys
- webhook secrets
- phone/SIP credentials
- bearer tokens
- provider secrets
- private access credentials

Use `.env.local` locally and deployment environment/secret storage remotely. `.env.example` contains names only.

# SABI Integration & Tool Contracts

Status: ACTIVE
Important: partner-specific payloads are provisional until verified against official docs.

## Agent tool principle

The LLM receives narrow tools, not unrestricted backend access.

## searchProviders

Purpose: return candidate providers that match basic criteria.

Concept:

```ts
searchProviders({
  category,
  item?,
  location?,
  verifiedOnly?
})
```

Returns provider IDs plus the minimum facts needed for planning.

## getProvider

Purpose: retrieve detail for one provider.

```ts
getProvider({ providerId })
```

## callProvider

Purpose: initiate a bounded provider conversation.

```ts
callProvider({
  missionId,
  providerId,
  objective
})
```

Example objective:

- confirm 20 yards of black Ankara
- ask total item price
- ask whether delivery to Yaba tomorrow is possible
- ask delivery fee

Expected immediate result should be an initiation status and external reference, not a fabricated completed quote.

## sendMessage

Fallback/alternate channel:

```ts
sendMessage({
  missionId,
  providerId,
  message
})
```

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

Input must be validated.

## compareQuotes

```ts
compareQuotes({ missionId })
```

Flow:

1. apply hard constraints
2. rank qualifying options
3. return explanation-ready factors
4. do not hide invalid/excluded reasoning from logs

## requestApproval

```ts
requestApproval({
  missionId,
  quoteId,
  providerId
})
```

Creates a pending approval. It does not purchase anything.

## Webhook contract pattern

Partner-specific endpoint examples may include:

```text
POST /api/webhooks/krosai
POST /api/webhooks/temlio
POST /api/webhooks/voice
```

Common handler responsibilities:

1. authenticate/verify event when supported
2. enforce idempotency where feasible
3. resolve external event to mission/provider
4. store raw/normalized communication outcome
5. extract structured fields
6. validate against Quote schema
7. update mission step/state
8. resume or trigger the agent
9. log failures honestly

## Integration adapter boundary

Partner logic should not leak through the whole application.

Concept:

```text
SABI domain
→ communication adapter interface
→ KrosAI / Temlio / other provider
```

This allows the team to swap or combine services without rewriting Mission logic.

## Voice/language

YarnGPT and Spitch are candidates for African-language voice/speech capability based on organizer material.

Do not hard-code one provider as mandatory until the team has verified:

- credentials
- latency
- language quality
- webhook behavior
- demo reliability
- integration time

## Secrets

Never commit:

- API keys
- webhook secrets
- phone credentials
- service tokens
- private access credentials

Use environment variables and maintain a safe `.env.example` only when application scaffolding begins.

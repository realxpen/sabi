# Lara Live-Call Gate

Status: READY FOR EXTERNAL LIVE-CALL CONFIGURATION
Last updated: 2026-10-01

## Stop point

Lara stops at the live Kros/Vapi phone-call gate.

No production merge and no real phone call are part of this gate. The branch should remain safe in mock mode until the external account prerequisites are available and one consenting test destination is explicitly configured.

## Ready now

### Branch / deployment

- GitHub branch: `lara/agent-tools`
- GitHub CI covers the bounded tools, communication adapters, webhook pipeline, persistence adapters, recovery and Vapi/Kros failure matrix.
- Vercel Preview is the deployment target for live-call preparation.
- Production remains untouched.

### Bimpe bounded tools

The five bounded HTTP actions are present:

```text
searchProviders
getProvider
callProvider
recordQuote
requestApproval
```

`callProvider` resolves the configured communication adapter in the Next.js route. Missing `SABI_COMMUNICATION_MODE` remains mock. Live mode must be explicitly selected with `vapi-kros`.

### Vapi / Kros runtime

Implemented:

```text
Bimpe callProvider
→ SABI bounded route
→ configured CommunicationAdapter
→ Vapi outbound call API
→ Kros BYO SIP number
→ Vapi webhook
→ authentication
→ durable Neon event deduplication
→ correlation
→ canonical CommunicationResult
```

Webhook endpoint:

```text
POST /api/webhooks/vapi
```

Expected authentication:

```text
Authorization: Bearer <VAPI_WEBHOOK_TOKEN>
```

### Failure handling

Covered before a real call:

- no answer → `NO_ANSWER`
- busy → `NO_ANSWER`
- provider/runtime failure → `FAILED`
- duplicate webhook → `DUPLICATE`
- malformed JSON → HTTP 400
- event without SABI call correlation → `UNKNOWN_CORRELATION`
- bad/missing Bearer token → HTTP 401
- live webhook while live mode is disabled → HTTP 503
- transcript evidence does not automatically create a Quote

### Neon

Preview database verification confirms:

- canonical Quotes persist with optional monetary/date/source fields preserved
- pending Approvals persist and remain non-transactional
- `communication_event_claims.event_id` is a primary key used by the durable duplicate-event claim path
- no-answer/failure normalization contains no Quote observation and the webhook never auto-creates a Quote

## Vapi assistant preparation

The SABI Vapi assistant should be configured for a bounded provider-qualification call. It must not claim availability, price or delivery terms on behalf of the provider.

Recommended first-call behavior:

1. identify itself as a test/demo assistant when appropriate
2. ask whether the provider can satisfy the bounded objective supplied in `{{objective}}`
3. ask factual follow-ups for availability, price, delivery fee and delivery timing
4. do not purchase, book, pay or promise payment
5. do not treat silence or no-answer as availability
6. allow the call to end cleanly and rely on the server event/transcript as evidence

Trusted per-call variables supplied by SABI:

```text
missionId
providerId
communicationId
objective
```

Server URL:

```text
https://sabi-git-lara-agent-tools-swifnatechnologyltd.vercel.app/api/webhooks/vapi
```

Attach a saved Bearer credential whose token matches the Preview `VAPI_WEBHOOK_TOKEN` value.

## Preview environment variables expected

```text
SABI_COMMUNICATION_MODE=mock
SABI_CONSENTED_PROVIDER_PHONES_JSON=

VAPI_API_BASE_URL=https://api.vapi.ai
VAPI_API_KEY=
VAPI_ASSISTANT_ID=
VAPI_SIP_TRUNK_CREDENTIAL_ID=
VAPI_WEBHOOK_TOKEN=

DATABASE_URL=
SABI_AGENT_TOOL_TOKEN=
```

Keep `SABI_COMMUNICATION_MODE=mock` while preparing account resources. Change it to `vapi-kros` only immediately before the consented live-call test.

`SABI_CONSENTED_PROVIDER_PHONES_JSON` must contain only explicitly consenting test participants/providers and must never be committed to the repository.

## External blockers — do not fake these

The only live-call blockers should be external account/telephony resources:

- Kros account/KYC readiness
- Kros number
- Kros call/event credit or usable balance
- outbound calling permission
- Kros SIP credentials
- Kros number imported into Vapi as BYO SIP
- matching Vapi SIP trunk credential ID
- configured SABI Vapi assistant ID
- saved Vapi webhook/server URL + Bearer credential
- one explicitly consenting test phone number
- actual live-call proof

## Live-call handoff checklist

When the external resources arrive:

1. Keep Production untouched.
2. Confirm the Kros number can make outbound calls.
3. Import/verify the Kros BYO SIP number in Vapi.
4. Confirm `VAPI_ASSISTANT_ID` and `VAPI_SIP_TRUNK_CREDENTIAL_ID`.
5. Configure the SABI Vapi server URL and Bearer credential.
6. Add one consenting destination to `SABI_CONSENTED_PROVIDER_PHONES_JSON` in Preview only.
7. Verify the Vapi read-only readiness check.
8. Set Preview `SABI_COMMUNICATION_MODE=vapi-kros`.
9. Trigger exactly one bounded `callProvider` test to the consenting destination.
10. Confirm `INITIATED` is returned first; do not call it completed yet.
11. Observe Vapi/Kros call lifecycle.
12. Verify webhook authentication, correlation and deduplication.
13. Confirm the final `CommunicationResult` is truthful.
14. Confirm no Quote is created from no-answer/failure.
15. Only create a Quote from factual, source-traceable provider evidence.
16. Return live mode to `mock` if further calls are not immediately required.

## Definition of Lara-done-before-live-call

Lara is ready to stop when all code/tests/Preview verification are green and the remaining unchecked items are external Kros/Vapi resources plus one consented real call.

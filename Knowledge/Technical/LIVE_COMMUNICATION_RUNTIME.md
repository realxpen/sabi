# Live Communication Runtime

Status: IMPLEMENTED / ACCOUNT CONFIGURATION REQUIRED
Last updated: 2026-10-01

## Purpose

This runtime upgrades the bounded `callProvider` tool from mock-only behavior to an explicitly enabled live-call path while preserving SABI truthfulness and human-approval boundaries.

## Implemented path

```text
BimpeAI callProvider
→ SABI bounded tool bridge
→ configured CommunicationAdapter
→ Vapi outbound call API
→ KrosAI BYO SIP phone number / telephony transport
→ provider phone
→ Vapi server events
→ SABI /api/webhooks/vapi
→ canonical CommunicationResult
```

The existing Kros webhook route remains available for transport-level integration once the live Kros event contract is confirmed against the event account/dashboard. No guessed Kros webhook parser or conflicting REST path has been hard-coded.

## Default behavior

`SABI_COMMUNICATION_MODE` defaults to `mock` when absent.

Live credentials by themselves do not activate calling.

To select the live path, set:

```text
SABI_COMMUNICATION_MODE=vapi-kros
```

## Consent gate

Live calls require an explicit server-side provider-to-phone mapping:

```text
SABI_CONSENTED_PROVIDER_PHONES_JSON
```

The value is a JSON object whose keys are canonical SABI provider IDs and whose values are E.164 phone numbers belonging to participants/providers who explicitly agreed to receive the test/demo call.

No provider absent from this mapping can be called. Real phone numbers must never be committed to the repository.

## Required Vapi configuration

```text
VAPI_API_BASE_URL
VAPI_API_KEY
VAPI_ASSISTANT_ID
VAPI_SIP_TRUNK_CREDENTIAL_ID
VAPI_WEBHOOK_TOKEN
```

The live adapter first retrieves Vapi phone-number resources and requires a `byo-phone-number` attached to the configured SIP trunk credential. It then calls Vapi's outbound phone-call endpoint with:

- configured assistant ID
- consented provider destination
- the matching BYO phone-number ID
- trusted `assistantOverrides.variableValues` containing `missionId`, `providerId`, `communicationId`, and the bounded call `objective`

A successful API response creates only an `INITIATED` `CommunicationResult`. It is not treated as a completed call or Quote evidence.

## Vapi webhook

Endpoint:

```text
POST /api/webhooks/vapi
```

Configure this as a saved Vapi server URL and attach a saved Bearer-token Custom Credential whose token matches `VAPI_WEBHOOK_TOKEN` in the SABI deployment environment.

Recommended Vapi server messages for the current implementation:

```text
status-update
end-of-call-report
transcript
```

The webhook:

1. requires explicit live mode
2. verifies Bearer authentication
3. parses Vapi's server-message envelope
4. resolves mission/provider correlation from server-supplied call variables
5. hashes the raw body to create a stable retry key
6. uses the existing durable Neon `communication_event_claims` deduplicator
7. normalizes lifecycle state into SABI `CommunicationResult`
8. never converts transcript text directly into a Quote

## Truthfulness rules

- API acceptance means `INITIATED`, not completed.
- Ringing/queued states remain initiation state.
- In-progress remains `IN_PROGRESS`.
- `customer-did-not-answer`, `customer-busy`, and voicemail normalize to `NO_ANSWER`.
- provider/runtime error reasons normalize to `FAILED`.
- a completed call may contain transcript evidence, but `observation` remains unset until factual extraction/validation is implemented.
- the Vapi webhook explicitly reports `quoteCreated: false`.
- no purchase, booking, payment, escrow, or provider selection is performed by this runtime.

## External account steps still required

Before a live test:

1. complete KrosAI account/KYC requirements
2. provision/identify a Kros phone number with outbound calling enabled
3. configure its SIP credentials in Vapi
4. import the Kros number into Vapi as a BYO SIP trunk number
5. confirm the Vapi assistant and SIP trunk credential IDs
6. configure the SABI Vapi webhook URL and saved Bearer credential
7. add one explicitly consenting test destination to `SABI_CONSENTED_PROVIDER_PHONES_JSON`
8. set `SABI_COMMUNICATION_MODE=vapi-kros` only in the intended Preview environment
9. make one consented call and verify initiation, ringing/answer/end state, webhook correlation, and transcript/result

Do not enable production or call an unconsenting/fictional destination.

## Verification

Regression coverage includes:

- mock remains default
- no consent mapping means no network request and canonical `FAILED`
- Vapi BYO phone-number lookup
- outbound request correlation variables
- accepted initiation returns `CALL / INITIATED`
- no-answer normalization creates no Quote observation
- transcript evidence creates no Quote observation
- webhook Bearer authentication
- durable duplicate webhook suppression through Neon

GitHub CI passed the code/test commit before this documentation update, and the Preview deployment built successfully.

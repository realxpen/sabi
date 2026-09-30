# Integration Access Checklist

Status: ACTIVE CHECKLIST
Last verified: 2026-09-30

Never paste secret values into documentation, issues, chat, or commits. Store local development secrets in `.env.local` and deployment secrets in the hosting provider's secret/environment system.

## SABI backend readiness — before external calls

- [ ] Public HTTPS URL for webhooks and Bimpe Custom API tools
- [ ] `SABI_PUBLIC_BASE_URL` configured
- [ ] Kros webhook route exists
- [ ] raw-body signature verification implemented
- [ ] provider event ID idempotency storage/logic
- [ ] communication correlation (`missionId`, `providerId`, `communicationId`)
- [ ] transcript/result → structured extraction seam
- [ ] `CommunicationResult` validation
- [ ] `Quote` validation
- [ ] unknown values remain unknown
- [ ] no-answer/busy/failure creates no fabricated Quote
- [ ] Mission Control reads actual state
- [ ] Approval causes no real financial transaction

## BimpeAI — core agent/knowledge/tool layer

- [ ] Create/sign in to BimpeAI Console
- [ ] Generate server-side API key with minimum required scopes
- [ ] Keep current Node 20 runtime initially
- [ ] Use REST/native `fetch` first rather than the Node-24+ TS SDK
- [ ] Create/select SABI workflow
- [ ] Create SABI agent
- [ ] Add curated text/URL Knowledge Base entries
- [ ] Keep current provider price/availability/transcript outside durable KB
- [ ] Expose safe SABI server API base URL
- [ ] Configure Bimpe Custom API integration
- [ ] Register only bounded tools required by the agent
- [ ] Include request/correlation IDs in logs
- [ ] Test one knowledge-grounded answer
- [ ] Test one SABI Custom API tool invocation
- [ ] Confirm the agent cannot directly purchase/pay/release funds

Recommended initial Bimpe tools:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

## KrosAI — critical telephony path

- [ ] Create/sign in to KrosAI account
- [ ] Complete KYC
- [ ] Confirm Nigeria number inventory/event credits
- [ ] Create least-privilege server API key
- [ ] Confirm required numbers/calls/endpoints/webhooks scopes
- [ ] Provision/claim one test phone number
- [ ] Enable outbound calling
- [ ] Select one voice endpoint provider
- [ ] Attach endpoint to phone number
- [ ] Confirm actual live REST base/path in API Explorer/minimal request
- [ ] Store confirmed base in `KROSAI_BASE_URL`
- [ ] Make one consented dashboard/Playground test call
- [ ] Make one consented API-triggered test call
- [ ] Confirm external call ID + lifecycle
- [ ] Create Kros webhook subscription
- [ ] Store webhook signing secret server-side
- [ ] Verify `X-Webhook-Signature` from raw request body
- [ ] Verify duplicate event handling
- [ ] Verify `missionId`/`providerId`/`communicationId` correlation
- [ ] Confirm live webhook event naming/payload convention
- [ ] Confirm transcript retrieval/event behavior
- [ ] Update `PARTNER_INTEGRATIONS.md` with confirmed live route/event names

## Vapi — first voice-runtime candidate

- [ ] Create/sign in to Vapi
- [ ] Create one SABI provider-calling Assistant
- [ ] Obtain Assistant ID
- [ ] Configure Kros SIP credentials in Vapi
- [ ] Import Kros number as BYO SIP-trunk number
- [ ] Obtain Vapi SIP Trunk Credential ID
- [ ] Connect Vapi credentials in Kros dashboard
- [ ] Create/attach Kros Vapi endpoint
- [ ] Test assistant directly in Vapi
- [ ] Test Kros-routed call
- [ ] Verify function/tool permissions if Vapi calls SABI APIs
- [ ] Freeze Vapi as primary only after repeated calls are reliable

## Retell / ElevenLabs — fallback only

Do not configure unless Vapi cannot be made reliable quickly.

## Spitch + LiveKit — optional multilingual enhancement

Only after primary phone flow is stable.

- [ ] Create Spitch API key
- [ ] Test one short TTS request
- [ ] Test one STT request
- [ ] Test one translation request if needed
- [ ] Choose exactly one demo language after English works
- [ ] If using LiveKit, create LiveKit project/credentials
- [ ] Configure LiveKit SIP trunk
- [ ] Run Spitch LiveKit STT/TTS agent
- [ ] Verify Kros → LiveKit dispatch
- [ ] Confirm audio quality/latency before adding to golden path

## YarnGPT — optional voice enhancement

- [ ] Create API key
- [ ] Add small credit balance if required
- [ ] Query live voice catalog instead of hard-coding IDs
- [ ] Test short TTS/streaming synthesis
- [ ] If using STT, store job ID + idempotency key and poll status
- [ ] Do not treat single-turn synthesis as a complete voice-agent pipeline

## Temlio — optional fallback

Current public documentation is insufficient for live implementation. Request/confirm:

- [ ] API base URL
- [ ] authentication method
- [ ] event/sandbox credentials or credits
- [ ] SMS send endpoint/request body
- [ ] sender ID/originating-number rules
- [ ] delivery receipt model
- [ ] delivery receipt webhook
- [ ] inbound SMS/reply webhook
- [ ] voice API contract if needed
- [ ] DID provisioning details
- [ ] rate limits
- [ ] retry/error semantics

Do not build live Temlio payloads until those are known.

## Consent / test numbers

- [ ] Every live test destination has explicitly agreed to receive test/demo calls
- [ ] No fictional demo phone number is ever dialed
- [ ] Mock/simulated/playground calls are labelled honestly

## Golden-path freeze checklist

- [ ] Mission created from canonical request
- [ ] candidate provider selected
- [ ] consented real phone receives call
- [ ] response/transcript captured
- [ ] `CommunicationResult` validated
- [ ] Quote factual/source-traceable
- [ ] Femi filter/rank works
- [ ] Mission Control updates from real state
- [ ] human approval requested
- [ ] no real payment/escrow action occurs
- [ ] fallback demo rehearsed

Once all are repeatable, freeze the primary stack before adding optional integrations.

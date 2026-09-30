# Integration Access Checklist

Status: ACTIVE CHECKLIST
Last verified: 2026-09-30

Never paste secret values into documentation, issues, chat, or commits. Store local development secrets in `.env.local` and deployment secrets in the hosting provider's secret/environment system.

## KrosAI — critical path

- [ ] Create/sign in to KrosAI account
- [ ] Complete KYC
- [ ] Confirm Nigeria number inventory/event credits
- [ ] Create least-privilege server API key
- [ ] Confirm `calls:read`, `calls:write`, `endpoints:read`, and webhook scopes needed for Lara's implementation
- [ ] Provision/claim one test phone number
- [ ] Enable outbound calling
- [ ] Select one voice endpoint provider
- [ ] Attach endpoint to phone number
- [ ] Confirm actual live REST base/path in API Explorer
- [ ] Store KrosAI base URL in configuration
- [ ] Make one consented dashboard/Playground test call
- [ ] Make one consented API-triggered test call
- [ ] Confirm call ID and lifecycle states
- [ ] Create SABI webhook endpoint
- [ ] Create Kros webhook subscription
- [ ] Store webhook signing secret server-side
- [ ] Send Kros webhook test event if dashboard/API permits
- [ ] Verify webhook signature from raw request body
- [ ] Verify duplicate event handling
- [ ] Verify `missionId`, `providerId`, `communicationId` correlation
- [ ] Confirm transcript retrieval/event behavior
- [ ] Record confirmed event names and final API route in PARTNER_INTEGRATIONS.md

## Vapi — primary fast voice-runtime candidate

- [ ] Create/sign in to Vapi
- [ ] Create one SABI provider-calling Assistant
- [ ] Obtain Assistant ID
- [ ] Configure KrosAI SIP trunk credentials in Vapi
- [ ] Import KrosAI phone number as BYO SIP-trunk number
- [ ] Obtain Vapi SIP Trunk Credential ID
- [ ] Connect Vapi API key in KrosAI dashboard
- [ ] Create/attach KrosAI Vapi endpoint
- [ ] Test assistant directly in Vapi
- [ ] Test a KrosAI-routed call
- [ ] Verify tool/function permissions if the assistant calls SABI APIs
- [ ] Freeze Vapi as primary runtime only if repeated calls are reliable

## BimpeAI — brain / knowledge / tools

- [ ] Create/sign in to BimpeAI Console
- [ ] Generate server-side API key with minimum required scopes
- [ ] Decide REST-via-fetch first; do not install the TS SDK until Node runtime decision is made
- [ ] Create/select a SABI workflow
- [ ] Create SABI agent
- [ ] Add curated SABI Knowledge Base entries
- [ ] Keep live provider price/availability outside the Knowledge Base
- [ ] Expose safe SABI server API base URL
- [ ] Configure Bimpe custom API integration
- [ ] Register only bounded tools required by the agent
- [ ] Include request/correlation IDs in logs
- [ ] Test knowledge-grounded answer in Playground/webchat/test channel
- [ ] Test one SABI custom API tool invocation
- [ ] Confirm the agent cannot directly purchase/pay/release funds

Recommended initial Bimpe tool set:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

## Spitch — multilingual enhancement

- [ ] Create API key
- [ ] Test one short TTS request
- [ ] Test one STT file/URL request
- [ ] Test one translation request if required
- [ ] Choose exactly one demonstration language after English works
- [ ] If using LiveKit, create LiveKit project and credentials
- [ ] Configure LiveKit SIP trunk
- [ ] Run Spitch LiveKit STT/TTS agent locally/hosted
- [ ] Verify KrosAI → LiveKit call dispatch
- [ ] Confirm audio quality and latency before adding to golden path

## YarnGPT — optional enhancement

- [ ] Create API key
- [ ] Add a small credit balance if required
- [ ] Query live voice catalog instead of hard-coding voice IDs
- [ ] Test short TTS / streaming TTS
- [ ] If using STT, store job ID and idempotency key and poll status
- [ ] Do not treat the single-turn streaming-conversation endpoint as a complete ASR+LLM voice agent

## Temlio — optional fallback

Current public documentation is insufficient for implementation. Request from Temlio/event team:

- [ ] API base URL
- [ ] authentication method
- [ ] event/sandbox credentials or credits
- [ ] SMS send endpoint and request body
- [ ] sender ID / originating number rules
- [ ] delivery receipt status model
- [ ] delivery receipt webhook contract
- [ ] inbound SMS/reply webhook contract
- [ ] voice API contract if the team intends to use it
- [ ] DID provisioning details
- [ ] rate limits
- [ ] retry/error semantics

Do not begin a live Temlio adapter until those are known.

## SABI backend readiness

- [ ] Public HTTPS URL for webhooks/tools
- [ ] Kros webhook route
- [ ] raw-body signature verification
- [ ] webhook idempotency/event storage
- [ ] communication correlation storage
- [ ] transcript/result → structured extraction
- [ ] `CommunicationResult` validation
- [ ] `Quote` validation
- [ ] unknown values remain unknown
- [ ] no-answer/busy/failure creates no fabricated Quote
- [ ] comparison uses Femi's module
- [ ] Mission Control uses actual stored state
- [ ] approval never triggers real payment in hackathon MVP
- [ ] primary + fallback demo rehearsed

## Consent / test numbers

Live test calls should go only to teammates/friends/providers who have explicitly agreed to participate in the demo/test. Never seed fictional phone numbers and then attempt real outbound calls to them.

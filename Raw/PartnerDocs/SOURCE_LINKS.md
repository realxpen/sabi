# Official Partner Integration Sources

Status: ACTIVE RAW SOURCE
Captured/verified: 2026-09-30

These are the partner/public documentation sources currently used to derive SABI integration decisions.

## KrosAI

Team-supplied sources:

- Quickstart: https://docs.krosai.com/getting-started/quickstart
- Simulate inbound call: https://docs.krosai.com/api-reference/calls/simulate-inbound-call
- ElevenLabs integration (Theneo): https://app.theneo.io/krosai/krosai-documentation/integration-1/elevenlabs
- Vapi integration (Theneo): https://app.theneo.io/krosai/krosai-documentation/integration-1/vapi
- Retell integration (Theneo): https://app.theneo.io/krosai/krosai-documentation/integration-1/retell
- Website: https://krosai.com/

Additional official pages used for verification:

- Introduction: https://docs.krosai.com/getting-started/introduction
- Authentication: https://docs.krosai.com/getting-started/authentication
- Outbound calls: https://docs.krosai.com/voice/outbound-calls
- Endpoints: https://docs.krosai.com/voice/endpoints
- Webhooks: https://docs.krosai.com/webhooks/overview
- Call logs: https://docs.krosai.com/voice/call-logs
- Vapi integration: https://docs.krosai.com/integration/vapi
- Retell integration: https://docs.krosai.com/integration-1/retell
- Documentation index when available: https://docs.krosai.com/llms.txt

Known source conflict:

- Quickstart examples use `https://api.krosai.com/v1/...`.
- Other API-reference pages describe `https://api.krosai.com/api/v1/...` and inconsistent outbound singular/plural paths.
- Older/current webhook pages also expose different event-name conventions.

Therefore live API Explorer/dashboard/minimal-request behavior must win over remembered examples before the adapter is frozen.

## BimpeAI

Official public docs discovered/verified during integration research:

- Quickstart: https://docs.bimpe.ai/docs/getting-started/quickstart/
- API Reference: https://docs.bimpe.ai/docs/api/
- TypeScript SDK: https://docs.bimpe.ai/docs/sdk/typescript/
- Configuring integrations/custom API tools: https://docs.bimpe.ai/docs/use-cases/configuring-integrations/
- Custom API integrations: https://docs.bimpe.ai/docs/api/agents/listCustomApi/

Verified high-level facts used in SABI:

- REST base: `https://api.bimpe.ai/api/v1/console`
- API-key auth via Bearer or `X-Api-Key`
- workflows + agents
- text/URL Knowledge Bases
- Custom API integrations and callable tools
- request correlation IDs
- current TypeScript SDK documentation targets Node 24+

## Temlio

- Website: https://temlio.com/

Public material confirms Voice, SMS, USSD, local numbers/DIDs and REST-style integrations, but detailed auth/request/webhook contracts are still needed from partner/event access before live implementation.

## YarnGPT

- API docs: https://yarngpt.ai/api-docs
- Quickstart: https://www.yarngpt.ai/get-started

Verified areas:

- Bearer API auth
- async TTS jobs
- low-latency streaming ticket flow
- real-time single-turn synthesis endpoint
- async ASR jobs
- live voice/language catalogs
- output-format rules/idempotency guidance

## Spitch

- Website: https://spitch.app/
- Docs index: https://docs.spitch.app/llms.txt
- Speech-to-text: https://docs.spitch.app/api/speech/stt
- Translation: https://docs.spitch.app/api/text/translate
- Speech generation/features: https://docs.spitch.app/features/speech
- LiveKit integration: https://docs.spitch.app/agents/livekit

Verified areas:

- Bearer API auth
- STT
- TTS
- translation
- Nigerian Pidgin/Yoruba/Hausa/Igbo/English language codes/capabilities in documented endpoints
- official LiveKit agent plugin/integration

## Source rule

Partner-specific code must be based on verified official documentation or current live account/API Explorer behavior.

Never invent:

- request fields
- signature schemes
- webhook payloads
- endpoint paths
- model/voice IDs
- phone-number rules
- authentication mechanisms

When official pages conflict:

1. record the conflict
2. centralize the uncertain behavior behind configuration/adapter code
3. verify using current API Explorer/dashboard or a minimal safe request
4. update `Knowledge/Technical/PARTNER_INTEGRATIONS.md`
5. update `Knowledge/Decisions/ACTIVE_DECISIONS.md` if architecture changes

# SABI — Lagos Agentic AI Hack Night Runbook

**Event:** Saturday, 3 October 2026 · Civic Hive, Yaba, Lagos  
**Doors open:** 2:00 PM  
**Main programme:** 4:00 PM  
**Focused build session:** 5:40 PM–7:40 PM  
**Team demos:** 7:40 PM

## Goal

Arrive with the product logic already stable. Use event time for BimpeAI configuration, the first real consented voice proof, polish, and rehearsal—not architecture work.

Canonical mission:

> I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.

## Current verified state before the event

- Neon database: ready
- Mission snapshot persistence: ready
- Communication claim/idempotency table: ready
- Mission Control: ready
- Perfume simulation: ready
- Femi intelligence and Decision Trace: ready
- Human approval stop: ready
- BimpeAI communication adapter: built
- Bimpe call polling: built
- Bimpe transcript evidence retrieval: built
- Supervised evidence → Quote bridge: built
- Live Voice Test Mission Control UI: built and CI-verified
- No-call Bimpe preflight: built

Current Preview configuration still needs to move from the old transport to BimpeAI before the first call.

## Environment variables to configure on Vercel Preview

### Required non-secret values

```env
SABI_COMMUNICATION_MODE=bimpe
BIMPEAI_BASE_URL=https://api.bimpe.ai/api/v1/console
BIMPEAI_TEST_CALLS=true
```

Keep `BIMPEAI_TEST_CALLS=true` for the first proof.

### Required secrets / IDs

```env
BIMPEAI_API_KEY=<team API key from BimpeAI>
BIMPEAI_AGENT_ID=<perfume voice agent id>
BIMPEAI_WORKFLOW_ID=<perfume workflow id>
SABI_OPERATOR_TOKEN=<strong private operator token>
SABI_AGENT_TOOL_TOKEN=<strong private internal tool token>
```

Do not put these values in GitHub, screenshots, demo slides, or chat messages that will be shared publicly.

### Canonical live test provider metadata

This contains no phone number:

```json
[
  {
    "id": "provider-perfume-test",
    "name": "Consenting Perfume Test Provider",
    "category": "Perfume",
    "location": "Lagos",
    "languages": ["English"],
    "verified": false,
    "active": true
  }
]
```

Set the entire JSON above as:

```env
SABI_LIVE_TEST_PROVIDERS_JSON=<json-array>
```

### Explicit consent phone mapping

Use only a number whose owner has agreed to receive the test call and write it in E.164 form.

```json
{
  "provider-perfume-test": "+234XXXXXXXXXX"
}
```

Set it as:

```env
SABI_CONSENTED_PROVIDER_PHONES_JSON=<json-object>
```

The provider ID must match exactly in both JSON variables.

## BimpeAI dashboard setup

1. Sign in to the BimpeAI Agent Dashboard.
2. Redeem Hack Night credits with `LAGOSHACKNIGHT` if not already done.
3. Create/select the SABI perfume procurement workflow.
4. Use `Knowledge/Product/BIMPE_PERFUME_VOICE_AGENT.md` as the canonical workflow prompt.
5. Create/select the SABI Hack Night voice agent and bind it to that workflow.
6. Configure the voice and greeting under Settings → Voice.
7. Generate the team API key under Team settings → API keys.
8. Record the agent ID and workflow ID.
9. Keep the first outbound proof in test-call mode.
10. Use a consenting teammate/tester number before any external supplier number.

## Tomorrow deployment sequence

### 1. Let the Preview build quota reset

Do not spend time repeatedly pushing deployment-only commits before the quota resets.

### 2. Add the Preview environment variables

Add all values above to the **Preview** environment for the SABI Vercel project.

### 3. Trigger one Preview deployment

Deploy the latest `integration/runtime-mission-control` head once.

### 4. Open `/readiness`

Expected minimum state before a call:

```text
Neon database              Ready
Mission storage            Ready
Bimpe API key              Ready
Voice agent ID             Ready
Console API                Ready
Safe test-call mode        Ready
Operator token             Ready
Live perfume providers     Ready
Consented phones           Ready
Selected voice runtime     Ready
```

### 5. Run the no-call BimpeAI preflight

Enter `SABI_OPERATOR_TOKEN` in the readiness screen and press:

```text
Run no-call preflight
```

The check is read-only. It must verify:

- Bimpe transport selected
- API key present and shaped correctly
- configured agent ID present
- configured workflow ID present
- test-call mode enabled
- provider directory valid
- consent mapping valid
- provider ID matches a consent entry
- Bimpe API reachable
- API credential accepted
- configured agent visible
- workflow match when Bimpe returns workflow metadata

Only proceed when the verdict says:

```text
Ready for the first consent-gated BimpeAI test call
```

## First real voice proof

### Mission creation

On SABI home:

1. Leave the canonical perfume mission in the text box.
2. Choose **Live Voice Test**.
3. Create mission.

Creating the mission does not call anyone.

### Mission Control

1. Enter `SABI_OPERATOR_TOKEN`.
2. Press **Prepare Live Voice Test**.
3. Confirm the configured consenting provider appears.
4. Select that provider.
5. Press **Call selected supplier** exactly once.

Expected flow:

```text
Calling supplier…
→ Supplier conversation active
→ Call completed
```

SABI also polls Bimpe automatically while the screen is open.

### After the call

1. Press **Retrieve call evidence**.
2. Read the transcript shown as evidence only.
3. Use the factual evidence form on the provider contact card.
4. Enter only facts explicitly confirmed in the call.
5. Leave unknown values blank.
6. Save evidence.

Expected data path:

```text
Bimpe call
→ CommunicationResult
→ transcript evidence
→ supervised factual fields
→ canonical Quote
→ deterministic intelligence
→ recommendation
→ AWAITING_APPROVAL
```

No purchase, payment, booking, or commitment occurs.

## Canonical consented test response

For the first deterministic proof, the consenting tester can role-play the supplier with these facts:

```text
Availability: Yes
Quantity available: 12 bottles
Product: 50ml long-lasting unisex perfume
Price for all 12: ₦96,000
Delivery fee to Yaba: ₦5,000
Final total: ₦101,000
Delivery: Tomorrow
Condition: Subject to buyer approval; no order has been placed yet
```

This is a controlled test fixture spoken during a real voice interaction. Do not present it as a live market quote from a real perfume business.

## Failure handling

### Readiness says Bimpe API key pending

Check `BIMPEAI_API_KEY` in Vercel Preview.

### Preflight returns API key rejected

Generate/copy the correct team API key and redeploy Preview.

### Preflight returns API key scope insufficient

Use a BimpeAI key with the read/call permissions needed by the Console API.

### Configured agent not visible

Confirm `BIMPEAI_AGENT_ID` belongs to the same team as the API key.

### Workflow mismatch

Confirm the agent is bound to `BIMPEAI_WORKFLOW_ID` in BimpeAI.

### Live provider directory pending

Fix `SABI_LIVE_TEST_PROVIDERS_JSON` and ensure it is a JSON array.

### Consented phone match is zero

The provider ID in `SABI_CONSENTED_PROVIDER_PHONES_JSON` must match the provider metadata ID exactly.

### Provider does not answer

Expected behavior:

```text
NO_ANSWER
→ no Quote
→ no fabricated response
```

Do not keep redialing repeatedly during the demo. Use the simulation fallback if needed.

### Bimpe telephony is temporarily unavailable

Use the labelled simulation to demonstrate the complete multi-provider decision path, then explain that the live Voice Test path is the same Mission Control contract with Bimpe as the transport.

## Event-day team roles

### Xpen — Product & Integration Lead

- own Vercel/Preview configuration
- run `/readiness`
- create the live perfume mission
- operate Mission Control
- present the product story
- control the human approval checkpoint

### Lara — Voice AI Lead

- own BimpeAI dashboard configuration
- confirm agent/workflow IDs
- confirm voice/greeting
- monitor the real test call
- diagnose Bimpe call status/log issues

### Femi — Intelligence & Evidence Lead

- verify captured provider facts
- ensure no transcript guessing
- verify Quote fields
- verify Decision Trace and recommendation
- explain why the recommendation satisfies the mission constraints

## Focused build-session discipline

The official focused build window is 5:40 PM–7:40 PM.

Recommended internal checkpoints:

### By 6:10 PM

- Preview deployed
- readiness green
- no-call preflight green

### By 6:30 PM

- first Bimpe test call completed
- transcript retrieved
- one factual Quote created

### By 6:50 PM

- recommendation / approval path confirmed
- simulation fallback rechecked

### By 7:05 PM

- feature freeze
- no architecture changes
- no dependency upgrades

### 7:05–7:30 PM

- rehearse demo at least twice
- one person times it
- verify laptop power/network/phone audio

### 7:30 PM

- stop coding except for a true show-stopper
- open the exact tabs/screens needed for the demo

## Demo tab order

Keep these ready before judging:

1. SABI home
2. `/readiness`
3. live perfume Mission Control
4. optional Bimpe dashboard call log
5. simulation Mission Control fallback

Avoid navigating GitHub/Vercel dashboards during the main demo unless a judge asks.

## 2–3 minute judge sequence

### 0:00–0:20 — Problem

Small businesses often find informal suppliers through calls, WhatsApp, referrals and manual price checking. The expensive part is not search alone—it is the repetitive conversation needed to verify stock, price and delivery.

### 0:20–0:40 — Mission

Show:

> I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.

Explain that SABI turns this into explicit constraints.

### 0:40–1:20 — Voice AI

Show the Bimpe Live Voice Test flow and the call state. If the call is already completed, show the transcript evidence and explain that transcript text is not trusted as a Quote automatically.

### 1:20–1:55 — Intelligence

Show factual fields → Quote → Decision Trace.

For the multi-provider simulation, show:

- one supplier qualifies
- one misses deadline
- one exceeds budget

### 1:55–2:20 — Human control

Show `AWAITING_APPROVAL`.

State clearly:

> SABI can do the repetitive work, but it stops before the consequential decision.

### 2:20–2:45 — Business value

Explain that the same pattern applies to procurement, lead qualification, service sourcing, reservation follow-up and other repetitive business conversations in the informal economy.

### 2:45–3:00 — Close

> SABI turns a business request into verified conversations, structured evidence and a decision-ready recommendation—with Voice AI doing the work and the human keeping control.

## Do-not-break rules

- never commit API keys or phone numbers
- never disable human approval for the hackathon
- never auto-create a Quote from transcript text
- never treat `INITIATED` as answered
- never treat `NO_ANSWER` as provider evidence
- never call a number without explicit consent
- never switch `BIMPEAI_TEST_CALLS=false` for the first proof
- never push a last-minute architecture rewrite after feature freeze

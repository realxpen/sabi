# Bimpe Mission Correlation Contract

Status: ACTIVE
Last updated: 2026-10-02
Owner: Lara — Agent Tools & Communication

## Purpose

Bimpe orchestrates bounded SABI tools, but SABI remains the system of record for Mission state and external correlation IDs.

A Bimpe voice/chat sourcing mission must therefore use one stable SABI `missionId` across provider contact, messaging, Quote persistence, webhook correlation, and Approval creation.

The previous playground placeholder `mission-001` is not safe for real or repeated sessions because unrelated conversations can collide on the same Mission correlation key.

## Runtime contract

`searchProviders` now returns a SABI-generated mission ID in response metadata:

```json
{
  "meta": {
    "missionId": "mission-bimpe-<uuid>",
    "missionIdPolicy": "Reuse this missionId for all stateful SABI tool calls in the current sourcing mission."
  }
}
```

Bimpe must:

1. Treat the first successful `Search Providers` call for a new sourcing request as the start of the current SABI mission.
2. Capture `meta.missionId` from that response.
3. Reuse that exact value for every stateful SABI tool call in the same sourcing mission:
   - `Call Provider`
   - `Send Message`
   - `Record Quote`
   - `Request Approval`
4. Keep using the established mission ID if the same mission performs additional provider searches.
5. Start a new mission only when the user begins a clearly new, unrelated sourcing request; the first successful provider search for that new request establishes a new mission ID.
6. Never invent a mission ID and never use the old static `mission-001` placeholder.

The SABI Bimpe bridge rejects `mission-001` on stateful actions with `INVALID_AGENT_TOOL_INPUT` so a stale workflow cannot silently corrupt live Vapi/Kros correlation.

## Bimpe Custom API action set

The bounded action manifest is:

```text
Search Providers
Get Provider
Call Provider
Send Message
Record Quote
Request Approval
```

`Send Message` maps to:

```text
POST /api/agent-tools/send-message
```

Exposing the action does not enable live SMS by itself. When no verified messaging transport is configured, the action returns canonical `UNAVAILABLE` with an explicit summary that no message was sent and `quoteCreated: false`.

## Required Bimpe workflow instruction

Add the following behavior to the live `SABI Mission` workflow/system prompt:

```text
MISSION CORRELATION
- For a new sourcing request, call Search Providers and capture meta.missionId from the first successful response.
- Reuse that exact missionId for Call Provider, Send Message, Record Quote, and Request Approval throughout the same sourcing mission.
- If you search again while working on the same user request, keep the already-established missionId rather than replacing it.
- Start a new mission only for a clearly new, unrelated sourcing request, using the new missionId returned by its first successful Search Providers call.
- Never use mission-001 and never invent a missionId.
- If a stateful tool reports that the missionId is invalid or missing, do not fabricate a replacement; run the bounded provider-search start step for the current mission and use the returned missionId.

MESSAGING FALLBACK
- Send Message is a bounded fallback communication action, not proof that a provider received or replied to a message.
- If Send Message returns UNAVAILABLE or FAILED, state that no verified message was sent or completed.
- A sent/delivered message is not a Quote. Record a Quote only from factual provider evidence that satisfies the Quote rules.
```

## Truthfulness rules

- A mission ID is a correlation key, not evidence that communication occurred.
- API initiation is not completion.
- `UNAVAILABLE`, no-answer, busy, and failure create no provider facts or Quote automatically.
- Transcript/message content is evidence only; Quote creation remains a separate validated action.
- Requesting Approval creates a `PENDING` human-approval record and performs no purchase, booking, payment, or fund transfer.

## Verification

Required regression coverage:

- two new provider searches receive distinct `mission-bimpe-<uuid>` identifiers;
- stateful tools reject the legacy `mission-001` placeholder;
- `Send Message` appears in the exported Bimpe action manifest;
- messaging without a configured transport returns `UNAVAILABLE`, not fake success;
- no messaging result automatically creates a Quote.

The live Bimpe dashboard must be synchronized with this contract separately because repository changes do not automatically mutate an already-configured Bimpe workflow or Custom API action list.

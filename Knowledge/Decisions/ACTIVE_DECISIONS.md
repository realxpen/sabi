# Active Decisions

Status: ACTIVE
Last updated: 2026-09-30

This file records current binding product/technical decisions.

## D-001 — Product name

Decision: Use **SABI**.

Status: ACTIVE

## D-002 — MVP focus

Decision: The hackathon MVP focuses on one procurement/provider-sourcing workflow.

Status: ACTIVE

Reason: One reliable end-to-end agentic flow is more valuable than many incomplete features.

## D-003 — Canonical demo

Decision: Use the black Ankara procurement request as the primary demo mission.

Status: ACTIVE

Canonical input:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## D-004 — Human control

Decision: Consequential actions require explicit human approval.

Status: ACTIVE

The MVP stops at approval and does not make a real purchase/payment.

## D-005 — Knowledge-first development

Decision: Use the AED-style `Raw/` + `Knowledge/` + `AGENTS.md` + `PROJECT_STATE.md` structure.

Status: ACTIVE

## D-006 — Knowledge lifecycle

Decision: Important knowledge uses ACTIVE / DEPRECATED / ARCHIVED lifecycle states.

Status: ACTIVE

## D-007 — LLM architecture

Decision: SABI is designed as:

```text
LLM / Agent
+ Knowledge/Retrieval
+ Memory
+ Operational Data
+ Tools
+ Guardrails
+ Human Approval
```

Status: ACTIVE

## D-008 — Mission as central object

Decision: Mission is the central operational workflow object.

Status: ACTIVE

## D-009 — Normalized Quote contract

Decision: All provider response channels normalize into a common Quote model.

Status: ACTIVE

## D-010 — Asynchronous communication

Decision: External calls/messages are asynchronous and resume Mission state through verified events/results.

Status: ACTIVE

## D-011 — Partner adapters

Decision: Partner services sit behind adapters/tools; partner payloads do not leak across the domain.

Status: ACTIVE

## D-012 — Application shape

Decision: Keep one Next.js/TypeScript application for the hackathon unless a partner runtime requires a small dedicated worker.

Status: ACTIVE

## D-013 — Matching strategy

Decision: Start with hard-constraint filtering plus transparent deterministic soft ranking.

Status: ACTIVE

## D-014 — Team ownership

Decision:

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

Status: ACTIVE

## D-015 — No silent shared-contract changes

Decision: Mission, Quote, Provider, CommunicationResult, states, approval semantics, and major tool contracts require coordinated changes.

Status: ACTIVE

## D-016 — Phase 0 boundary

Decision: Phase 0 is complete; implementation is now in parallel Phase 1/integration work.

Status: ACTIVE

Supersedes the earlier Phase-0-only build boundary wording.

## D-017 — SABI remains system of record

Decision: SABI, not any external agent/voice provider, remains authoritative for Mission, Provider, CommunicationResult, Quote, recommendation state, Approval, guardrails, and external correlation IDs.

Status: ACTIVE

## D-018 — BimpeAI role

Decision: Use BimpeAI as the agent/workflow/Knowledge-Base/bounded-tool orchestration layer.

Status: ACTIVE

BimpeAI does not replace SABI Mission state or receive unrestricted database access.

## D-019 — Bimpe integration method

Decision: Use BimpeAI REST API with server-side native `fetch` first.

Status: ACTIVE

Reason: the current official TypeScript SDK documents Node 24+, while SABI CI currently runs Node 20. Only adopt `@bimpeai/sdk` after an intentional Node/runtime upgrade and full CI verification.

## D-020 — KrosAI role

Decision: KrosAI is the primary telephony transport for the golden path.

Status: ACTIVE

It owns phone-number transport, call lifecycle, logs/transcripts, and webhook delivery—not SABI domain truth.

## D-021 — KrosAI endpoint ambiguity

Decision: Do not hard-code a single remembered Kros base path. Use `KROSAI_BASE_URL` and centralize route construction inside the adapter until the live API Explorer/minimal request confirms the working route.

Status: ACTIVE

Reason: current official docs show both `/v1` and `/api/v1` examples plus inconsistent singular/plural outbound paths.

## D-022 — Voice runtime order

Decision: Test Vapi first behind KrosAI. If it is not reliable quickly, test Retell, then ElevenLabs.

Status: ACTIVE

Do not make multiple voice runtimes simultaneous critical-path dependencies.

## D-023 — Webhook normalization

Decision: Kros-specific event names/statuses are translated centrally into SABI `CommunicationResult` states before Mission mutation.

Status: ACTIVE

Webhook retries must be idempotent; `initiated` is not treated as `completed`.

## D-024 — Multilingual enhancement

Decision: Add African-language voice only after the base English phone loop is stable.

Status: ACTIVE

Preferred advanced path:

```text
KrosAI → LiveKit SIP → LiveKit Agent → Spitch STT/TTS → SABI/Bimpe tools
```

YarnGPT remains optional for TTS/translation/streaming audio/post-call STT.

## D-025 — Temlio role

Decision: Reserve Temlio primarily for communication fallback (especially SMS after no-answer/busy/failure) once detailed partner API contracts/credentials are available.

Status: ACTIVE

Do not invent Temlio payloads from marketing pages.

## D-026 — Knowledge vs live facts

Decision: Durable policy/domain guidance may live in SABI Knowledge/Bimpe KB. Live provider price, availability, delivery promises, transcripts, and call outcomes remain operational/tool data.

Status: ACTIVE

## D-027 — Demo freeze

Decision: Freeze the primary stack when this is repeatable:

```text
Mission
→ provider selected
→ real consented phone receives call
→ response/transcript captured
→ Quote validated
→ options compared
→ Mission Control updated
→ human approval requested
```

Status: ACTIVE

After this gate, multilingual voice, SMS fallback, and secondary providers are optional enhancements only.

## Decision update rule

When replacing a decision:

1. preserve the old entry
2. mark it DEPRECATED
3. state why it changed
4. point to the superseding decision
5. add the new ACTIVE decision

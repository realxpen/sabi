# Active Decisions

Status: ACTIVE
Last updated: 2026-09-29

This file records current binding Phase 0 decisions.

## D-001 — Product name

Decision: Use **SABI**.

Status: ACTIVE

Reason: The name aligns naturally with the concept of knowing how/where/who to use to get something done without requiring a forced acronym.

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

Reason: Three humans and multiple coding agents need one authoritative operating context.

## D-006 — Knowledge lifecycle

Decision: Important knowledge uses ACTIVE / DEPRECATED / ARCHIVED lifecycle states.

Status: ACTIVE

Reason: Prevent old decisions from silently conflicting with current architecture.

## D-007 — LLM architecture

Decision: SABI is designed as:

```text
LLM
+ Knowledge/Retrieval
+ Memory
+ Operational Data
+ Tools
+ Guardrails
+ Human Approval
```

Status: ACTIVE

Reason: Durable knowledge, live facts, personal history, and actions have different trust/freshness properties and should not be collapsed into one prompt.

## D-008 — Mission as central object

Decision: Mission is the central operational workflow object.

Status: ACTIVE

## D-009 — Normalized Quote contract

Decision: All provider response channels normalize into a common Quote model.

Status: ACTIVE

Reason: Intelligence/comparison should not depend on whether the response came from call, SMS, or another channel.

## D-010 — Asynchronous communication

Decision: External calls/messages are asynchronous and resume Mission state through events/webhooks.

Status: ACTIVE

Reason: Real-world communications do not fit a long blocking request/response lifecycle.

## D-011 — Partner adapters

Decision: Partner services must sit behind adapters.

Status: ACTIVE

Reason: Exact APIs/access are not yet fully verified, and the team may combine or swap services based on event reliability.

## D-012 — Application shape

Decision: Prefer one Next.js/TypeScript application for the hackathon rather than multiple deployed services.

Status: ACTIVE

Reason: Reduce deployment/integration complexity for a three-person vibe-coding team.

## D-013 — Matching strategy

Decision: Start with hard-constraint filtering plus transparent deterministic soft ranking.

Status: ACTIVE

Reason: Explainability and reliability are more important than forcing ML into the MVP.

## D-014 — Team ownership

Decision:

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

Status: ACTIVE

## D-015 — No silent shared-contract changes

Decision: Mission, Quote, Provider, states, approval semantics, and major tool contracts require coordinated changes.

Status: ACTIVE

## D-016 — Build boundary

Decision: Phase 0 contains no serious application implementation. Phase 1 begins only after team review.

Status: ACTIVE

## Decision update rule

When replacing a decision:

1. preserve the old entry
2. change its status to DEPRECATED
3. state why it changed
4. point to the superseding decision
5. add the new ACTIVE decision

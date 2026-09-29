# PROJECT_STATE.md

Status: ACTIVE
Last updated: 2026-09-29

## Current phase

**Phase 0 — Project Intelligence Foundation**

Current goal: establish one authoritative product, architecture, knowledge, and team-operating context before serious implementation begins.

## Event target

- Event: Lagos Agentic AI Build Day / Hack Night
- Date: 2026-10-03
- Location: Civic Hive, Yaba, Lagos

## Current product

**SABI — AI Agent for the Informal Economy**

Core principle:

> Tell SABI what you need. SABI helps you get it done.

## Locked MVP hypothesis

An AI agent can take a user's informal-commerce request, convert it into a structured mission, discover relevant providers, communicate with real people, collect structured information, compare qualifying options, and return an actionable recommendation while preserving human approval for consequential action.

## Canonical demo mission

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Phase 0 outputs

- [x] Product source
- [x] MVP boundary
- [x] Trust model
- [x] Team ownership
- [x] System architecture
- [x] LLM knowledge/retrieval architecture
- [x] Mission model/state machine
- [x] Integration contracts
- [x] Demo flow
- [x] Evaluation plan
- [x] Hackathon positioning
- [x] Active decisions
- [x] Root AGENTS.md
- [x] Root PROJECT_STATE.md

## Not started

- Application scaffold
- Supabase project/schema
- Runtime LLM integration
- BimpeAI integration
- Telephony integration
- Messaging fallback
- Partner-specific webhook implementation
- Mission Control UI
- Provider demo dataset
- End-to-end demo testing

## Current team ownership

- Xpen — Product & Integration
- Femi — Intelligence, Data & Knowledge
- Lara — Agent Tools & Communication

## Current blockers / unknowns

- Final partner API credentials and exact event allocations.
- Exact API/webhook contracts for partner services must be confirmed from official documentation/access.
- Final decision on which speech/language provider combination gives the most reliable event demo.
- Confirmation of any event restriction on how much implementation may be prepared before the official build window.

## Next phase

**Phase 1 — MVP Skeleton**

Planned outcomes:

1. scaffold the application
2. define shared schemas
3. seed demo providers
4. create mission creation/read flow
5. implement Mission Control with mocked adapters first
6. preserve integration interfaces so partner APIs can be connected without rewriting the product core

Do not start Phase 1 until the three-person team has reviewed Phase 0 and agrees on the demo mission and ownership.

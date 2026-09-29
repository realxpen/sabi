# SABI System Architecture

Status: ACTIVE

## Architecture objective

Support one reliable agentic workflow without overbuilding.

## High-level model

```text
User
 ↓
Web Experience / Mission Control
 ↓
Mission API
 ↓
Context Assembler
 ├─ Current Mission
 ├─ Relevant Knowledge / Retrieval
 ├─ Provider Data
 ├─ User Preferences (when available)
 └─ Previous Relevant Interaction Context
 ↓
SABI Agent / Orchestrator
 ↓
Planner
 ↓
Explicit Tool Layer
 ├─ searchProviders
 ├─ getProvider
 ├─ callProvider
 ├─ sendMessage
 ├─ recordQuote
 ├─ compareQuotes
 └─ requestApproval
 ↓
Integration Adapters
 ├─ BimpeAI
 ├─ KrosAI
 ├─ Temlio
 ├─ YarnGPT
 └─ Spitch
 ↓
Real-world communication
 ↓
Webhook / Result Events
 ↓
Mission state + structured Quote
 ↓
Agent resumes
 ↓
Recommendation
 ↓
Human approval
```

Partner selection remains adapter-based until exact API access is verified.

## Suggested implementation stack

For the hackathon:

- Next.js + TypeScript
- server/API routes in the same application for speed
- Supabase/PostgreSQL
- Zod for validation
- polling or Supabase Realtime for Mission Control updates
- partner services behind adapters

Avoid splitting the MVP into unnecessary deployable services.

## Core data entities

Minimum operational entities:

- missions
- providers
- mission_steps
- communications
- quotes
- approvals

Potential later entities:

- users
- preferences
- memories
- orders
- payments
- escrows
- reviews
- disputes

## Domain ownership

Mission is the core stateful workflow object.

Provider is operational supply data.

Quote is the canonical normalized provider response.

Knowledge is durable guidance, not operational transaction state.

Memory is user/history context, not platform policy.

## Agent execution rule

The LLM does not directly mutate arbitrary database tables.

Preferred flow:

```text
LLM decision
→ explicit tool
→ validated input
→ system action
→ validated result
→ state transition
→ observation returned to agent
```

## External communication

Calls/messages are asynchronous.

Do not hold a normal request open while waiting for a real phone conversation.

Preferred flow:

```text
Agent
→ callProvider()
→ provider service returns externalCallId
→ mission remains in CONTACTING/COLLECTING
→ call occurs
→ webhook arrives
→ verify/parse event
→ normalize result
→ store communication
→ create/update quote
→ advance mission
→ agent resumes
```

## Failure architecture

Important flows require:

```text
Success
+ Failure
+ Recovery
+ Terminal state
```

Examples:

- provider does not answer → try another provider / optional message fallback
- malformed webhook → reject safely and log
- missing quote field → mark unknown, request follow-up if required
- one provider fails → mission continues if enough viable providers remain
- all providers fail → mission escalates/fails honestly

## Observability

At minimum capture:

- mission transitions
- tool calls
- partner request IDs
- partner result status
- communication outcomes
- quote extraction result
- recommendation inputs
- approval status
- errors

Do not log secrets.

## Security

- API keys server-side only
- validate all external inputs
- verify webhook authenticity when the provider supports signatures
- use least-privilege access
- do not expose private provider/user data unnecessarily to the LLM
- keep permission boundaries explicit

## Scalability principle

Do not design a distributed system for a two-hour demo. Build simple boundaries that can evolve later.

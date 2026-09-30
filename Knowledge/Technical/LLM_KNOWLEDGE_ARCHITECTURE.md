# LLM Knowledge, Retrieval & Memory Architecture

Status: ACTIVE
Last updated: 2026-09-30

## Core distinction

SABI is not only an LLM connected to tools.

The intelligence stack is:

```text
Agent / LLM
+ Knowledge
+ Retrieval
+ Memory
+ Operational Data
+ Tools
+ Guardrails
+ Human Approval
```

These components have different responsibilities and different freshness/trust properties.

## Current runtime direction

BimpeAI is the planned agent/workflow/Knowledge/bounded-tool layer.

SABI remains system of record for Mission, Provider, CommunicationResult, Quote, recommendation state and Approval.

Conceptually:

```text
SABI Mission
   ↓
Context Assembler
   ├─ relevant Knowledge
   ├─ live operational facts
   ├─ permitted memory
   ├─ recent tool observations
   └─ permission state
   ↓
BimpeAI Agent / Workflow
   ↓
bounded SABI API tools
   ↓
validated result
   ↓
SABI state transition
```

The agent does not receive unrestricted database access.

## Knowledge

Durable, curated understanding used across missions/users.

Examples:

- trust policy
- procurement policy
- approval rules
- provider-category guidance
- communication rules
- fraud/truthfulness rules
- active product/architecture decisions

During development, canonical Knowledge lives in `Knowledge/`.

For runtime agent grounding, a small curated subset may be loaded into BimpeAI Knowledge Bases.

## BimpeAI Knowledge Base boundary

Current Bimpe docs support Knowledge Bases from text and URL sources.

Good Bimpe KB content:

```text
SABI Trust Policy
SABI Approval Policy
Procurement Rules
Provider Communication Rules
Category Guidance
Truthfulness / Anti-hallucination Rules
```

Bad Bimpe KB content:

```text
Tola Fabrics has 20 yards available today for ₦62,000.
```

That is a live operational fact and belongs in provider/tool/communication data.

## Retrieval

Retrieval selects only knowledge relevant to the current Mission.

Do not inject the entire repository Knowledge tree or Bimpe KB into every prompt.

Example:

```text
Mission: buy lunch under ₦5,000
→ retrieve food/procurement policy
→ retrieve approval policy
→ retrieve trust rules
→ attach current provider facts separately
→ agent reasons
```

## Memory

Memory is user/history-specific context.

Examples:

- typical budget
- favorite meals
- delivery tolerance
- preferred vendors
- previous ratings
- past Mission outcomes

Memory may be:

- `EXPLICIT` — directly provided by the user
- `HISTORY` — inferred from prior behavior

Do not overgeneralize from weak history. Do not turn uncertain inference into durable policy.

## Operational data

Operational data includes:

- active Mission
- Provider records
- CommunicationResult
- transcript/result source
- Quote
- MissionStep
- Approval

Operational data belongs in application storage/state, not durable Knowledge.

## Context assembler

Before a significant reasoning step, assemble only what is needed:

```text
current user request
+ structured Mission
+ relevant retrieved Knowledge
+ minimal provider/Quote facts
+ permitted user memory
+ latest relevant tool observations
+ current approval/permission state
```

Context should be:

- relevant
- minimal
- permission-aware
- source-traceable
- fresh enough for the decision

## Tool boundary

BimpeAI may call bounded SABI Custom API tools such as:

```text
searchProviders
getProvider
callProvider
recordQuote
compareQuotes
requestApproval
```

Every tool validates input and enforces SABI guardrails.

The agent must not directly mutate arbitrary tables or bypass approval semantics.

## Retrieval priority

```text
ACTIVE
  ↓
DEPRECATED only for historical reasoning
  ↓
ARCHIVED only when explicitly useful
```

Deprecated knowledge must not silently override ACTIVE guidance.

## Minimal runtime RAG/Knowledge MVP

1. curate a small knowledge set
2. assign stable source IDs/topics
3. retrieve/select only relevant chunks
4. keep live facts separate
5. pass relevant context to Bimpe/agent
6. log what knowledge/tool observations informed the result
7. preserve approval state separately from model reasoning

The demo does not need a massive vector database.

## Hallucination / freshness control

SABI must distinguish:

- durable Knowledge
- live provider facts
- memory/preferences
- model inference
- tool outcomes

Live facts such as current price, availability and delivery promise must come from provider/tool/communication results.

A transcript is evidence; it must be extracted/validated before it becomes Quote data.

Unknown values stay unknown.

## Runtime compatibility

BimpeAI's current TypeScript SDK documentation targets Node 24+ while SABI CI currently runs Node 20.

For the hackathon, prefer:

```text
server-side native fetch
→ Bimpe REST API
```

Only migrate to `@bimpeai/sdk` after an intentional Node runtime upgrade and full build/test verification.

## Knowledge update loop

```text
interaction / external evidence
→ observation
→ validation
→ human/authorized decision if needed
→ Knowledge update
→ old conflicting knowledge deprecated
→ retrieval favors new ACTIVE knowledge
```

Operational call/quote events do not automatically become durable knowledge.

The knowledge base is living infrastructure, not a dump of notes or stale transactions.

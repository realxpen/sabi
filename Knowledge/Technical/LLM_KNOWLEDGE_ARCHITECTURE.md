# LLM Knowledge, Retrieval & Memory Architecture

Status: ACTIVE

## Core distinction

SABI is not only an LLM connected to tools.

The intelligence stack is:

```text
LLM
+ Knowledge
+ Retrieval
+ Memory
+ Operational Data
+ Tools
+ Guardrails
+ Human Approval
```

These components have different responsibilities.

## Knowledge

Durable, curated understanding used across users and missions.

Examples:

- product rules
- trust policy
- procurement policy
- approval rules
- provider-category knowledge
- communication guidance
- active architectural/business decisions

Knowledge lives in `Knowledge/` during development. Runtime knowledge may later be indexed into a retrieval system.

## Retrieval

Retrieval selects only the knowledge relevant to the current mission.

Do not blindly put the entire knowledge base into every prompt.

Example:

```text
User asks for lunch under ₦5,000
→ mission extracted
→ retrieve food sourcing rules
→ retrieve approval policy
→ retrieve relevant trust policy
→ assemble only relevant context
→ LLM reasons
```

## Memory

Memory is specific to a user or past interactions.

Examples:

- typical lunch budget
- favorite meals
- delivery tolerance
- preferred vendors
- previous ratings
- past mission outcomes

Memory can be explicit or inferred.

Represent the difference:

- EXPLICIT — directly provided by the user
- HISTORY — inferred from behavior/history

Do not overgeneralize from weak history.

## Operational data

Operational data includes:

- active mission
- provider records
- current quote
- communication result
- mission step
- approval status

Operational data belongs in the application database, not the LLM knowledge base.

## Context assembler

Before each significant agent reasoning step, assemble:

```text
Current user request
+ structured mission
+ relevant retrieved knowledge
+ minimal provider/quote facts needed
+ relevant user memory
+ recent tool observations
+ permission/approval state
```

Context should be:

- relevant
- minimal
- permission-aware
- traceable
- fresh enough for the decision

## Retrieval priority

During development:

```text
ACTIVE
  ↓
DEPRECATED only for historical reasoning
  ↓
ARCHIVED only when explicitly useful
```

Deprecated knowledge must not silently override active guidance.

## Runtime RAG MVP

A minimal runtime RAG slice can be included if reliable:

1. prepare a small set of curated knowledge chunks
2. retrieve by mission/query
3. attach source identifiers to retrieved chunks
4. let the model reason only over relevant chunks
5. log what was retrieved

The demo does not need a massive vector database to prove the idea.

## Hallucination control

SABI must distinguish between:

- durable knowledge
- live provider facts
- user preferences
- model inference

Live facts such as current price and availability should come from provider data/tools, not from static knowledge or model memory.

## Knowledge update loop

Future evolution:

```text
Interaction / evidence
→ observation
→ human or authorized decision
→ Knowledge update
→ old conflicting knowledge deprecated
→ retrieval uses new ACTIVE knowledge
```

The knowledge base is living infrastructure, not a dump of notes.

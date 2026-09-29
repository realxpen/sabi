# Team Ownership

Status: ACTIVE
Team size: 3

## Xpen — Product & Integration Lead

Primary responsibility:

> Does the whole SABI experience work coherently?

Owns:

- product scope
- architecture coordination
- repository coherence
- frontend / Mission Control experience
- human-approval UX
- trust/guardrail product rules
- integration across modules
- deployment
- demo choreography
- pitch/presentation

## Femi — Intelligence, Data & Knowledge Lead

Primary responsibility:

> Does SABI make sensible, explainable decisions from the context and data it receives?

Owns:

- mission extraction quality
- provider schema/data quality
- hard-constraint filtering
- provider matching/ranking
- quote normalization logic
- knowledge base organization
- retrieval/context assembly
- preference model
- evaluation cases
- recommendation explanation

Do not add ML simply because the role is data-oriented. A transparent deterministic ranker is preferable for the MVP if it is reliable and explainable.

## Lara — Agent Tools & Communication Lead

Primary responsibility:

> Can SABI take a bounded external action and reliably understand what happened?

Owns:

- mission state transitions
- tool contracts
- telephony integration
- messaging fallback
- African-language/speech integration where used
- webhook lifecycle
- event-to-state transformations
- retry/recovery behavior
- integration error handling

Functional-programming discipline is encouraged for predictable input → transformation → new-state behavior.

## Shared-contract rule

No teammate or coding agent may silently redefine:

- Mission schema
- Quote schema
- Provider schema
- mission states
- approval semantics
- major API/tool contracts

Changes must be coordinated because all three workstreams depend on them.

## Vibe-coding rule

Do not tell three coding agents to independently “build SABI.”

Humans decide the architecture. Knowledge records the architecture. AI agents implement bounded tasks within it.

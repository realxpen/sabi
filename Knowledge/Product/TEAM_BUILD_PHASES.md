# Three-Person Vibe-Coding Build Phases

Status: ACTIVE PLAN
Team: Xpen, Femi, Lara

## Key rule

The team should not wait for Xpen to finish the whole application.

The synchronization point is:

**Shared schemas + mission state machine + adapter contracts are merged.**

Once that exists, all three people build in parallel.

## Before the official build window

The exact event rule on pre-built implementation still needs confirmation, so separate preparation from competition coding.

All three can start preparation immediately.

### Xpen

- maintain product source and architecture
- prepare UI references/wireframes
- prepare Codex prompts
- verify repo/branch workflow
- prepare demo script

### Femi

- read Product + Technical knowledge
- prepare provider demo dataset design
- prepare mission extraction examples
- prepare matching rules
- prepare evaluation cases
- understand LLM knowledge/retrieval architecture
- explore how BimpeAI knowledge/context may map to SABI once access is available

### Lara

- read architecture + integration contracts
- research partner documentation/access when available
- map call lifecycle
- map webhook lifecycle
- define communication failure cases
- prepare tool input/output examples
- test/understand KrosAI, Temlio, YarnGPT, and Spitch capabilities when access permits

If organizers require product code to be written during the event, stop at documentation, research, prompts, wireframes, schemas-on-paper, and API understanding before the build window.

## BUILD PHASE A — Shared foundation

Primary owner: Xpen.

Compressed target: first 15–25 minutes.

Tasks:

- scaffold app
- implement shared schemas
- implement mission states
- create adapter interfaces
- create demo data contract
- ensure app runs

Femi and Lara do not sit idle:

- Femi finalizes test cases, sample data, ranking logic, and retrieval chunks.
- Lara verifies credentials/docs, maps partner payloads, and prepares integration prompts.

### Gate A

When these contracts exist and compile:

- Mission
- Provider
- Quote
- MissionStep
- Approval
- CommunicationResult
- communication adapter interface

Xpen pushes/merges the foundation.

**This is when Femi and Lara start coding.**

## BUILD PHASE B — Three parallel workstreams

### Xpen — Experience + orchestration shell

Branch: xpen/mvp-shell

Build:

- Home / mission input
- Mission Control
- mission summary
- real timeline rendering
- result cards
- approval UI
- API/route glue
- integration visibility
- visual polish

### Femi — Intelligence + data + LLM knowledge

Branch: femi/intelligence

#### F1 — Demo data

Create 5–8 fictional providers with capabilities, location, demo verification/reliability, and test scenarios.

#### F2 — Hard constraints

Implement deterministic filtering:

- item/service match
- availability
- quantity
- deadline
- hard budget

#### F3 — Soft ranking

Rank only qualifying providers/quotes using explainable factors such as price, verification, reliability, location, and rating.

Return explanation-ready reasons, not only a score.

#### F4 — Quote intelligence

Validate and normalize quote data.

Never invent missing values.

#### F5 — Knowledge/retrieval

Implement the minimal retrieval seam:

- curated MVP knowledge chunks
- relevant-chunk retrieval
- source IDs
- context assembler interface

Keep knowledge separate from live provider data.

#### F6 — Evaluation

Test:

- happy path
- deadline conflict
- over-budget options
- missing data
- no-answer provider
- all providers invalid
- irrelevant knowledge retrieval

Femi gate: given structured quotes + a mission, his module returns valid candidates, recommendation factors, and relevant context.

### Lara — Tools + communications + agent workflow

Branch: lara/agent-tools

#### L1 — Tool layer

Prepare/implement:

- searchProviders
- getProvider
- callProvider
- sendMessage
- recordQuote
- requestApproval

Tools must use shared schemas.

#### L2 — Communication adapter

Implement mock adapter first if real credentials are unavailable.

Handle:

- initiated
- completed
- no answer
- unavailable
- failed

#### L3 — Mission event handling

Map:

external event → validation → normalized observation → mission/provider resolution → quote/update → state transition

#### L4 — Partner integration

Once verified access exists, implement the chosen real communication path behind the adapter.

Do not spread partner-specific code through the domain layer.

#### L5 — Webhooks/recovery

Handle:

- duplicate event
- malformed event
- missing provider/mission mapping
- call failure
- delayed response

#### L6 — African-language/speech layer

Only add YarnGPT/Spitch after the base communication loop works.

Lara gate: a provider contact action produces a truthful structured communication result the main app can consume.

## BUILD PHASE C — First integration

All three together.

Merge in this order:

1. stable foundation
2. Femi intelligence/data
3. Lara communication/tools
4. Xpen Mission Control glue

Required result:

request → mission → providers → contact → quote → compare → recommendation → approval

No feature additions until this works.

## BUILD PHASE D — Real partner swap

Only after mock end-to-end works.

- Lara replaces the mock communication adapter with the best verified partner integration.
- Femi ensures incoming responses normalize correctly.
- Xpen ensures Mission Control displays real state.

The domain layer should not need a rewrite.

## BUILD PHASE E — Knowledge/LLM activation

Femi leads.

Connect the agent to:

- current mission
- relevant retrieved knowledge
- current provider/quote facts
- permission state
- latest tool observations

Do not dump the full Knowledge folder into every prompt.

## BUILD PHASE F — Demo hardening

All three.

Test:

- primary demo
- backup demo
- no-answer
- partner failure
- over-budget result
- missing data
- approval rejection

Then freeze features.

## Failure ownership

- UI/state wrong → Xpen
- matching/recommendation/context wrong → Femi
- call/message/webhook/action wrong → Lara
- shared contract/integration wrong → all three stop and resolve it together

## Vibe-coding session rule

Every teammate starts their coding-agent session with:

“Read AGENTS.md, PROJECT_STATE.md, the relevant ACTIVE Knowledge files, and the shared schemas before editing. Do not change shared contracts or architecture without explaining the conflict first. Work only on the assigned phase and run the relevant tests before reporting completion.”

Then append the specific phase instructions from this document.

## Handoff rule

Each teammate reports:

- what was implemented
- files changed
- tests run
- assumptions made
- blockers
- whether a shared contract needs discussion
- exact commit/branch

Do not hand off with only “it should work.”

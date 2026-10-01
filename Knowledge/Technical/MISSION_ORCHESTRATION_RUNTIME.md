# SABI Mission Orchestration Runtime

Status: IMPLEMENTED / LIVE TRANSPORT GATED

## Purpose

The orchestration runtime owns the safe progression of a persisted Mission. It connects Xpen's Mission Control, Lara's communication adapter and Femi's deterministic intelligence without allowing one module to silently redefine another module's contract.

## Progressive flow

```text
CREATED
→ UNDERSTANDING
→ PLANNING
→ SEARCHING
→ CONTACTING
→ COLLECTING_QUOTES
→ COMPARING
→ AWAITING_APPROVAL
```

`AWAITING_APPROVAL` is a hard human checkpoint. The orchestrator does not purchase, book, pay, release escrow or otherwise perform a consequential transaction.

## One stage per call

`advanceMissionOrchestration()` advances at most one lifecycle stage. This makes state visible in Mission Control, makes failures resumable and avoids pretending that a multi-step external workflow completed atomically.

## Simulation mode

Simulation mode is allowed only for snapshots with `demoMode: true`.

It may use the explicit SABI demo provider/Quote fixtures. All communication evidence is marked with channel `MOCK`, Quote source references remain the mock scenario reference, and the UI must continue to describe the evidence as simulated.

Simulation mode must never be presented as a real provider interaction.

## Live mode

Live mode never imports simulation providers or Quotes.

If validated provider candidates are missing, it stops at `SEARCHING` with `WAITING_FOR_PROVIDER_DISCOVERY`.

If provider contact has been initiated but no validated Quote exists yet, it stops at `COLLECTING_QUOTES` with a waiting result.

The live orchestration HTTP route requires:

- `Authorization: Bearer <SABI_AGENT_TOOL_TOKEN>`
- `SABI_COMMUNICATION_MODE=vapi-kros`
- the existing Vapi/Kros consent and runtime configuration

The browser does not automatically invoke live orchestration. It only refreshes persisted state for live missions.

## Intelligence

At `COMPARING`, the runtime invokes Femi's deterministic `recommend()` implementation against the currently persisted Mission, Provider and Quote objects.

Hard constraints are applied before ranking. Unknown values remain unknown. If no qualifying Quote exists, the Mission stays at `COMPARING` rather than inventing a recommendation.

## User experience

New missions are now persisted first at `CREATED` instead of being generated directly at the final demo state.

For simulation missions, Mission Control calls the simulation orchestration endpoint one stage at a time and refreshes the server-rendered state. This makes the actual lifecycle visible:

```text
understand → plan → search → contact → collect → compare → approval
```

When Lara's live phone transport is ready, the same Mission state machine remains in place; the communication source changes from the explicit simulation adapter to the authenticated live adapter.

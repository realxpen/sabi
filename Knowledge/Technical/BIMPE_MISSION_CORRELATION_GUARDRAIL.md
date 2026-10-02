# Bimpe Mission Correlation Guardrail

Status: ACTIVE HACK-NIGHT WORKFLOW RULE

Use this together with `BIMPE_SABI_AGENT_PROMPT.md` in the live SABI Mission workflow.

## One mission per sourcing request

1. Call `Start Mission` exactly once for a new sourcing request.
2. Pass the user's complete original sourcing request to `Start Mission.request`.
3. Save the returned `data.missionId` as the current mission ID.
4. Reuse that exact mission ID for every later stateful action in the same sourcing mission.
5. Never call `Start Mission` again because the user asks a follow-up question, clarifies quantity, asks for price, asks about delivery, or provides another detail for the same mission.
6. Start a new mission only when the user clearly begins a new unrelated sourcing request or the current mission has been cancelled/completed and the user explicitly starts another one.
7. Never invent, hard-code, or fall back to `mission-001` or another guessed mission ID.

## Provider discovery

For the current live hack-night provider directory, keep the proven Search Providers request body exactly:

```json
{
  "mode": "LIVE"
}
```

Do not add query, category, location, or language fields to the live Search Providers body unless that behavior is re-tested and deliberately changed later.

## Contact truthfulness

1. `Start Mission` does not contact a provider.
2. `Search Providers` does not contact a provider.
3. `Get Provider` does not contact a provider.
4. Never say "I am contacting suppliers", "I have reached out", "I am gathering information from the provider", or equivalent wording unless `Call Provider` was actually invoked for the current mission and returned a communication result.
5. A `Call Provider` result with status `INITIATED` means only that the call request was initiated. It does not mean the provider answered.
6. Only report that a provider answered after the persisted communication reaches `COMPLETED` or another verified answered state supported by the backend.
7. Never report price, availability, delivery fee, total, quantity capacity, or delivery timing until those facts come from verified communication evidence.

## Required sequence for the live demo

```text
User request
→ Start Mission ONCE
→ save data.missionId
→ Search Providers with {"mode":"LIVE"}
→ choose returned provider
→ Call Provider with the saved missionId + providerId
→ wait for real communication state/evidence
→ extract only verified facts
→ record provider response / Quote
→ compare
→ request human approval
→ STOP
```

## Same-mission follow-ups

If the user asks a follow-up such as:

- "What is the total price?"
- "Can they deliver tomorrow?"
- "Can they supply all 12 bottles?"
- "Do they accept any brand?"

Do not create another mission. Treat the question as part of the current mission and reuse the existing `data.missionId`.

If a needed fact is not yet known, say it is not yet verified and obtain it through the appropriate bounded action/evidence path. Do not create a new mission just to ask the provider another question.

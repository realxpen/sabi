# SABI Hackathon Canonical Demo — Perfume Procurement

## Canonical mission

> I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.

Structured mission:

- Type: PROCUREMENT
- Item: 50ml long-lasting unisex perfume
- Quantity: 12
- Unit: bottles
- Budget: ₦120,000
- Location: Yaba
- Deadline: tomorrow
- Human approval required: yes

## Why this is the canonical demo

The mission is easy to understand but still forces SABI to reason about multiple hard constraints. A cheap option is not automatically good if it misses the deadline, and a fast option is not acceptable if it breaks the budget.

## Simulation provider outcomes

### ScentHub Yaba (Demo)

- Available: yes
- Product price: ₦96,000
- Delivery fee: ₦5,000
- Total: ₦101,000
- Delivery: tomorrow
- Expected result: QUALIFIES

### Luxe Aroma Surulere (Demo)

- Available: yes
- Product price: ₦105,000
- Delivery fee: ₦5,000
- Total: ₦110,000
- Delivery: 2 days
- Expected result: REJECT
- Reason: misses the hard delivery deadline

### Mira Scents (Demo)

- Available: yes
- Product price: ₦118,000
- Delivery fee: ₦6,000
- Total: ₦124,000
- Delivery: tomorrow
- Expected result: REJECT
- Reason: exceeds the hard ₦120,000 budget

## Expected recommendation

SABI should recommend ScentHub Yaba (Demo) because it is the only simulated provider that satisfies all hard constraints:

- available
- total within ₦120,000
- delivery tomorrow

The recommendation must stop at AWAITING_APPROVAL.

No purchase, payment, booking, transfer, or delivery instruction is performed by the hackathon MVP.

## Canonical demo flow

1. Open SABI with the canonical perfume mission already populated.
2. Create the mission.
3. Show SABI structuring quantity, item, budget, location, deadline, and approval requirement.
4. Run simulation if live telephony is not being used.
5. Show provider discovery.
6. Show provider contact activity.
7. Show the three factual responses/Quotes.
8. Show Femi intelligence rejecting Luxe Aroma for deadline and Mira Scents for budget.
9. Show ScentHub Yaba as the recommendation.
10. Stop visibly at Human Approval.

## 2–3 minute judge sequence

### 0:00–0:20 — The problem

Explain that much of the informal economy is fragmented across calls, WhatsApp, referrals, and people the user may not already know. SABI turns a natural-language need into a mission and coordinates the work.

### 0:20–0:40 — Give SABI the mission

Use the canonical perfume request. Point out that the user specifies the outcome rather than manually browsing sellers.

### 0:40–1:10 — Mission execution

Show Mission Control moving through understanding, planning, finding providers, contacting providers, and collecting factual responses.

If using simulation, say clearly that the contacts shown are labelled simulation fixtures. If live calling is available, show the real consenting test-provider call path instead.

### 1:10–1:50 — Intelligence

Show all three provider outcomes. Emphasize that SABI does not simply choose the cheapest number:

- ScentHub: qualifies
- Luxe Aroma: cheaper than the budget but too late
- Mira Scents: can deliver tomorrow but breaks the budget

Show the Decision Trace and recommendation.

### 1:50–2:15 — Human control

Show AWAITING_APPROVAL. Explain that SABI can do the legwork but consequential action remains under human control.

### 2:15–2:40 — Architecture proof

Briefly explain:

- Lara: communication/tool layer
- Femi: deterministic filtering/ranking and knowledge
- Xpen: mission orchestration, persistence, Mission Control, safety gates
- Neon: durable mission state
- Vapi + Kros: live call transport when enabled
- Bimpe: bounded orchestration/tool surface

### 2:40–3:00 — Close

SABI is not another static marketplace. It is an agent interface for getting real-world informal-economy tasks done while keeping the human in control of consequential decisions.

## Live-call version

When Kros/Vapi is ready, replace only the simulated contact leg:

Mission → consenting test provider → Vapi → Kros → phone → factual response → webhook → CommunicationResult → supervised/validated evidence → Quote → Femi intelligence → recommendation → human approval.

The rest of Mission Control and the recommendation flow should remain unchanged.

## Failure recovery to rehearse

### Provider does not answer

Display NO_ANSWER. Do not create a Quote. Continue with other settled provider responses when safe.

### Provider call fails

Display FAILED. Do not invent evidence or a Quote.

### Completed call lacks factual fields

Display Needs factual evidence. Use supervised evidence capture to enter only facts the provider actually confirmed.

### No provider qualifies

Display No qualifying provider. Do not silently relax the user's budget or deadline. The user must decide whether to change constraints.

## Demo reset

Use Restart demo to clear providers, communications, Quotes, steps, and recommendation while keeping the same canonical perfume mission. Then Run simulation to rehearse again.

## Truth rules

- Simulation must remain labelled as simulation.
- A transcript is evidence, not automatically a Quote.
- NO_ANSWER and FAILED never create Quotes.
- Unknown facts stay unknown.
- Provider facts must be traceable to communication evidence.
- Budget and deadline are hard constraints unless the human changes them.
- No consequential transaction occurs without explicit human approval.

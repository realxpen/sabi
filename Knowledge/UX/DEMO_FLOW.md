# SABI Hackathon Demo Flow

Status: ACTIVE

## Demo objective

Make the agentic nature obvious within seconds.

The audience should see:

```text
Intent
→ AI planning
→ real-world action
→ external response
→ structured result
→ reasoning
→ human approval
```

## Primary mission

User enters:

> I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.

## Screen 1 — Home

Primary element:

> What do you need?

Suggested quick examples:

- Find me lunch
- Find a photographer
- Buy something locally
- Find someone to fix something

For the demo, type the canonical mission directly.

## Screen 2 — Mission interpretation

Show extracted constraints clearly:

- Black Ankara
- 20 yards
- Yaba
- tomorrow
- ≤ ₦70,000
- approval required

Avoid overwhelming the user with raw JSON.

## Screen 3 — Mission Control

This is the centerpiece.

Example:

```text
✓ Request understood
✓ 3 relevant providers found
✓ Calling Tola Fabrics
● Calling Ade Textiles
○ Collecting remaining quotes
○ Comparing offers
○ Waiting for your approval
```

If a real phone call is part of the demo, the teammate/vendor phone should ring while Mission Control visibly shows the current action.

## Provider conversation

The AI should ask only what the mission requires.

Example:

- Do you have 20 yards of black Ankara available?
- What is the total price?
- Can you deliver to Yaba tomorrow?
- What is the delivery fee?
- What delivery time can you commit to?

## Screen 4 — Results

Example:

```text
3 contacted
2 available
1 unavailable

BEST MATCH
Ade Textiles — Verified
20 yards: ₦60,000
Delivery: ₦3,000
Total: ₦63,000
Delivery: tomorrow
```

Explain:

> Recommended because it satisfies the quantity and deadline, stays within the ₦70,000 budget, and has the strongest qualifying total/reliability combination.

## Screen 5 — Human approval

Show:

- provider
- total
- deadline
- reason
- Approve
- Choose another
- Cancel

The product stops here for the hackathon.

## Strongest wow moment

A judge should be able to observe:

1. user enters a real-world request
2. agent acts
3. a real phone rings / real communication occurs
4. the external answer becomes structured UI data
5. SABI reasons over the result
6. SABI asks the human instead of autonomously spending

## Failure fallback

If the primary call integration fails during the demo:

1. show the truthful failed call state
2. use an implemented SMS/alternate demo channel if available
3. never claim a simulated result came from a successful live call
4. maintain a clearly labeled fallback path for presentation continuity

## Demo freeze

Once this exact flow works repeatedly, stop feature building.

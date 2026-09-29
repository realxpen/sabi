# SABI Trust & Human-Control Model

Status: ACTIVE

## Principle

SABI should reduce coordination friction without reducing meaningful human control.

Trust is a system property, not a single verification badge.

## MVP trust stack

```text
Seeded/known provider set
+ verification status
+ explicit mission constraints
+ factual quote capture
+ explainable comparison
+ human approval
```

## Provider trust signals

Potential signals include:

- verified phone/contact
- identity/business verification
- location evidence
- registration evidence where relevant
- past completed work
- rating and review history
- cancellations
- disputes
- response rate
- fulfilment reliability
- repeat customers

For the hackathon, most signals may be seeded/demo data. The UI must not imply that mock verification is production verification.

## Human approval

The agent may:

- understand the request
- search
- filter
- call/message
- collect information
- compare
- recommend
- prepare the next action

The default agent may not:

- purchase
- book
- send money
- release escrow
- accept a major price change
- exceed a hard budget
- materially alter the user's constraints

without explicit approval.

## Truthfulness

Unknown values remain unknown.

A failed tool call must never be represented as success.

A provider who did not answer must not be treated as having quoted.

A quote extracted from communication must remain traceable to its source.

## Future escrow model

Future transaction flow may use:

```text
Buyer funds escrow
→ provider fulfils
→ buyer confirms / rules resolve
→ funds release
```

Escrow is not part of the hackathon MVP.

## Permission expansion

Future autonomy must be explicit, bounded, and revocable.

Example:

> “You can reorder lunch from approved vendors up to ₦5,000 on weekdays.”

This is materially different from unrestricted purchasing authority.

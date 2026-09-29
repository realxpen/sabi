# SABI MVP Evaluation Plan

Status: ACTIVE

## Why evaluation matters

The demo should not merely show that the LLM can produce plausible text. It should show that SABI makes correct, explainable decisions under constraints and fails safely.

## Evaluation dimensions

### Mission extraction

Given a user request, does SABI correctly identify:

- item/service
- quantity
- budget
- location
- deadline
- approval requirement

### Hard-constraint filtering

Test case:

- Budget: ₦70,000
- Deadline: tomorrow

Providers:

- A: ₦65,000, tomorrow
- B: ₦55,000, three days
- C: ₦69,000, tomorrow

Expected:

- B is excluded because the deadline fails.
- A and C remain.

### Unknown information

If provider price is unknown, expected behavior is:

- mark it unknown
- contact provider if needed
- do not invent a price

### No-answer behavior

If Provider A does not answer but B and C do:

- mission continues
- A is recorded as no answer
- A does not receive a fake quote

### Budget protection

If all quotes exceed a hard ₦70,000 budget:

- do not recommend one as “within budget”
- explain that no current offer satisfies the constraint
- ask whether the user wants to change constraints or continue searching

### Approval protection

Expected:

- recommendation can be created automatically
- purchasing/booking/payment does not proceed without explicit approval

### Retrieval

Given a mission, does the knowledge layer retrieve only relevant policy/context instead of dumping unrelated documentation?

### Recommendation explanation

The recommendation should refer to observable facts:

- total price
- deadline
- availability
- verification/reliability signal

Avoid unexplained black-box scores in the user-facing answer.

## Minimum pre-demo test set

Prepare at least:

1. happy-path procurement
2. deadline conflict
3. over-budget options
4. one no-answer provider
5. missing quote field
6. all providers unavailable
7. duplicate webhook/event
8. approval rejection
9. irrelevant knowledge retrieval
10. tool failure with truthful recovery

## Evaluation ownership

Femi leads evaluation design.

Xpen validates product expectations.

Lara validates tool/event/recovery behavior.

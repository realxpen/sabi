# Mission Domain Model & State Machine

Status: ACTIVE

## Mission

A Mission represents the user's desired real-world outcome and the workflow required to reach a human decision point.

Conceptual TypeScript contract:

```ts
type MissionType = "PROCUREMENT" | "SERVICE";

type MissionStatus =
  | "CREATED"
  | "UNDERSTANDING"
  | "PLANNING"
  | "SEARCHING"
  | "CONTACTING"
  | "COLLECTING_QUOTES"
  | "COMPARING"
  | "AWAITING_APPROVAL"
  | "APPROVED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "ESCALATED";

type Mission = {
  id: string;
  type: MissionType;
  status: MissionStatus;
  rawRequest: string;
  item: string;
  quantity?: number;
  unit?: string;
  budget?: number;
  location?: string;
  deadline?: string;
  preferences?: string[];
  approvalRequired: boolean;
  createdAt: string;
};
```

## Provider

```ts
type Provider = {
  id: string;
  name: string;
  category: string;
  phone?: string;
  location: string;
  languages: string[];
  verified: boolean;
  rating?: number;
  completedTransactions?: number;
  reliabilityScore?: number;
  active: boolean;
};
```

## Quote

All provider channels normalize into one Quote contract.

```ts
type QuoteSource = "CALL" | "SMS" | "MANUAL" | "OTHER";

type Quote = {
  id: string;
  missionId: string;
  providerId: string;
  available: boolean;
  price?: number;
  deliveryFee?: number;
  total?: number;
  deliveryDate?: string;
  notes?: string;
  source: QuoteSource;
  sourceReference?: string;
  createdAt: string;
};
```

Unknown fields remain absent/unknown. Never fill them with guesses.

## Mission step

```ts
type MissionStepStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED";

type MissionStep = {
  id: string;
  missionId: string;
  type: string;
  status: MissionStepStatus;
  message: string;
  createdAt: string;
};
```

Mission Control renders real stored steps rather than fake animation.

## Approval

```ts
type Approval = {
  id: string;
  missionId: string;
  action: "SELECT_PROVIDER";
  providerId: string;
  quoteId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
};
```

## State machine

Happy path:

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

After user choice:

```text
AWAITING_APPROVAL
  ├─ APPROVED → COMPLETED (hackathon stop)
  └─ REJECTED/CANCELLED
```

## Failure behavior

A provider failure is not automatically a mission failure.

Example:

```text
Provider A → no answer
Provider B → quote
Provider C → quote
Mission → continue
```

Use FAILED/ESCALATED only when the mission cannot proceed safely or meaningfully.

## Hard constraints before ranking

Examples:

- correct product/service
- required quantity
- available
- deadline achievable
- hard budget satisfied

Only qualifying candidates proceed to soft ranking.

## Soft ranking

Possible signals:

- total price
- verification
- reliability
- location
- rating
- previous successful experience

Weights are a product decision and should remain explainable rather than arbitrary.

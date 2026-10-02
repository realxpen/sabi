import type { Mission, Provider, Quote } from "../schemas";

export type ConstraintStatus = "PASS" | "FAIL" | "UNKNOWN";

export type ExclusionCode =
  | "PROVIDER_UNAVAILABLE"
  | "ITEM_CATEGORY_MISMATCH"
  | "QUOTE_UNAVAILABLE"
  | "OVER_BUDGET"
  | "DEADLINE_MISMATCH";

export type UncertaintyCode =
  | "TOTAL_UNKNOWN"
  | "BUDGET_UNVERIFIED"
  | "DEADLINE_UNKNOWN"
  | "QUANTITY_CAPACITY_UNKNOWN";

export type ConstraintCode =
  | "PROVIDER_ACTIVE"
  | "ITEM_CATEGORY"
  | "QUOTE_AVAILABILITY"
  | "TOTAL_KNOWN"
  | "BUDGET"
  | "DEADLINE"
  | "QUANTITY_CAPACITY";

export type ExclusionReason = { code: ExclusionCode; message: string };
export type UncertaintyReason = { code: UncertaintyCode; message: string };
export type ConstraintCheck = {
  code: ConstraintCode;
  status: ConstraintStatus;
  message: string;
};

export type CandidateEvaluation = {
  provider: Provider;
  quote: Quote;
  status: ConstraintStatus;
  qualifies: boolean;
  exclusions: ExclusionReason[];
  uncertainties: UncertaintyReason[];
  checks: ConstraintCheck[];
};

const aliases: Record<string, string[]> = {
  fabric: ["fabric", "ankara", "cloth", "textile", "material"],
  food: ["food", "lunch", "meal", "breakfast", "dinner"],
  photography: ["photographer", "photography", "photo"],
  plumbing: ["plumbing", "plumber", "pipe"],
  electrical: ["electrician", "electrical", "wiring"]
};

const norm = (value: string) => value.trim().toLowerCase();

export function providerMatchesMissionItem(mission: Mission, provider: Provider): boolean {
  const item = norm(mission.item);
  const category = norm(provider.category);
  return (
    item.includes(category) ||
    category.includes(item) ||
    (aliases[category] ?? []).some((alias) => item.includes(alias))
  );
}

export function deadlineMatches(
  missionDeadline: string | undefined,
  deliveryDate: string | undefined
): boolean {
  return (
    missionDeadline !== undefined &&
    deliveryDate !== undefined &&
    norm(missionDeadline) === norm(deliveryDate)
  );
}

function overallStatus(checks: ConstraintCheck[]): ConstraintStatus {
  if (checks.some((check) => check.status === "FAIL")) return "FAIL";
  if (checks.some((check) => check.status === "UNKNOWN")) return "UNKNOWN";
  return "PASS";
}

export function evaluateCandidate(
  mission: Mission,
  provider: Provider,
  quote: Quote
): CandidateEvaluation {
  const exclusions: ExclusionReason[] = [];
  const uncertainties: UncertaintyReason[] = [];
  const checks: ConstraintCheck[] = [];

  if (!provider.active) {
    const message = "Provider is not currently active.";
    exclusions.push({ code: "PROVIDER_UNAVAILABLE", message });
    checks.push({ code: "PROVIDER_ACTIVE", status: "FAIL", message });
  } else {
    checks.push({ code: "PROVIDER_ACTIVE", status: "PASS", message: "Provider is active." });
  }

  if (!providerMatchesMissionItem(mission, provider)) {
    const message = "Provider category does not match the requested item/service.";
    exclusions.push({ code: "ITEM_CATEGORY_MISMATCH", message });
    checks.push({ code: "ITEM_CATEGORY", status: "FAIL", message });
  } else {
    checks.push({
      code: "ITEM_CATEGORY",
      status: "PASS",
      message: "Provider category matches the requested item/service."
    });
  }

  if (!quote.available) {
    const message = "Provider response says the requested option is unavailable.";
    exclusions.push({ code: "QUOTE_UNAVAILABLE", message });
    checks.push({ code: "QUOTE_AVAILABILITY", status: "FAIL", message });
  } else {
    checks.push({
      code: "QUOTE_AVAILABILITY",
      status: "PASS",
      message: "Quote marks the requested option as available."
    });
  }

  if (quote.total === undefined) {
    const message = "Total cost is unknown because a factual total is not represented.";
    uncertainties.push({ code: "TOTAL_UNKNOWN", message });
    checks.push({ code: "TOTAL_KNOWN", status: "UNKNOWN", message });
  } else {
    checks.push({
      code: "TOTAL_KNOWN",
      status: "PASS",
      message: `Factual quoted total is ₦${quote.total.toLocaleString()}.`
    });
  }

  if (mission.budget === undefined) {
    checks.push({
      code: "BUDGET",
      status: "PASS",
      message: "Mission does not represent a hard budget."
    });
  } else if (quote.total === undefined) {
    const message = "Hard budget cannot be verified while the total is unknown.";
    uncertainties.push({ code: "BUDGET_UNVERIFIED", message });
    checks.push({ code: "BUDGET", status: "UNKNOWN", message });
  } else if (quote.total > mission.budget) {
    const message = `Total ₦${quote.total.toLocaleString()} exceeds the hard budget of ₦${mission.budget.toLocaleString()}.`;
    exclusions.push({ code: "OVER_BUDGET", message });
    checks.push({ code: "BUDGET", status: "FAIL", message });
  } else {
    checks.push({
      code: "BUDGET",
      status: "PASS",
      message: `Total is within the hard budget of ₦${mission.budget.toLocaleString()}.`
    });
  }

  if (mission.deadline === undefined) {
    checks.push({
      code: "DEADLINE",
      status: "PASS",
      message: "Mission does not represent a hard deadline."
    });
  } else if (quote.deliveryDate === undefined) {
    const message = "Delivery date is unknown, so the deadline cannot be verified.";
    uncertainties.push({ code: "DEADLINE_UNKNOWN", message });
    checks.push({ code: "DEADLINE", status: "UNKNOWN", message });
  } else if (!deadlineMatches(mission.deadline, quote.deliveryDate)) {
    const message = `Quoted delivery date "${quote.deliveryDate}" does not match the mission deadline "${mission.deadline}".`;
    exclusions.push({ code: "DEADLINE_MISMATCH", message });
    checks.push({ code: "DEADLINE", status: "FAIL", message });
  } else {
    checks.push({
      code: "DEADLINE",
      status: "PASS",
      message: `Quoted delivery date matches the mission deadline "${mission.deadline}".`
    });
  }

  if (mission.quantity === undefined) {
    checks.push({
      code: "QUANTITY_CAPACITY",
      status: "PASS",
      message: "Mission does not represent a hard quantity/capacity requirement."
    });
  } else if (!quote.available) {
    checks.push({
      code: "QUANTITY_CAPACITY",
      status: "FAIL",
      message: "The option is unavailable, so the requested quantity cannot be fulfilled."
    });
  } else {
    const unit = mission.unit ? ` ${mission.unit}` : "";
    const message = `The current Quote contract does not represent provider capacity, so availability of ${mission.quantity}${unit} cannot be independently verified.`;
    uncertainties.push({ code: "QUANTITY_CAPACITY_UNKNOWN", message });
    checks.push({ code: "QUANTITY_CAPACITY", status: "UNKNOWN", message });
  }

  const status = overallStatus(checks);
  return {
    provider,
    quote,
    status,
    qualifies: status === "PASS",
    exclusions,
    uncertainties,
    checks
  };
}

export function evaluateCandidates(
  mission: Mission,
  providers: Provider[],
  quotes: Quote[]
): CandidateEvaluation[] {
  const byId = new Map(providers.map((provider) => [provider.id, provider]));

  return quotes.map((quote) => {
    const provider = byId.get(quote.providerId);
    if (!provider) {
      const message = "Provider record is missing.";
      return {
        provider: {
          id: quote.providerId,
          name: "Unknown provider",
          category: "Unknown",
          location: "Unknown",
          languages: [],
          verified: false,
          active: false
        },
        quote,
        status: "FAIL" as const,
        qualifies: false,
        exclusions: [{ code: "PROVIDER_UNAVAILABLE" as const, message }],
        uncertainties: [],
        checks: [{ code: "PROVIDER_ACTIVE" as const, status: "FAIL" as const, message }]
      };
    }

    return evaluateCandidate(mission, provider, quote);
  });
}

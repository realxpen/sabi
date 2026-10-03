import { missionSchema, type Mission } from "../schemas";

function parseMoney(raw: string): number | undefined {
  const value = raw.replace(/,/g, "").trim();
  if (!value) return undefined;

  const shorthand = value.match(/^(\d+(?:\.\d+)?)\s*k$/i);
  if (shorthand) {
    return Math.round(Number(shorthand[1]) * 1000);
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

const UNIT_PATTERN =
  "yards?|pieces?|pcs?|units?|bottles?|packs?|boxes?";

export function parseDemoMissionRequest(
  rawRequest: string,
  id = "demo-mission"
): Mission {
  const normalized = rawRequest.trim();

  const quantityMatch = normalized.match(
    new RegExp(`(?:need|find me|buy)?\\s*(\\d+)\\s*(${UNIT_PATTERN})`, "i")
  );

  const budgetMatch =
    normalized.match(
      /(?:\bbudget(?:\s*,?\s*including\s+delivery\s*,?)?(?:\s+is)?|\bmaximum|\bmax|\bunder|\bbelow|\bless than)\s*[:=]?\s*(?:₦|NGN\s*|N)?\s*(\d[\d,]*(?:\.\d+)?\s*k?)/i
    ) ??
    normalized.match(/(?:₦|\bNGN\s*|\bN)\s*(\d[\d,]*(?:\.\d+)?\s*k?)/i);

  const locationMatch =
    normalized.match(
      /(?:delivered?|delivery)\s+to\s+([A-Za-z][A-Za-z\s'-]*?)(?=\s+(?:before|by|tomorrow|today|on)\b|[,.]|$)/i
    ) ??
    normalized.match(
      /\b(?:in|around)\s+([A-Za-z][A-Za-z\s'-]*?)(?=\s+(?:before|by|tomorrow|today|on)\b|[,.]|$)/i
    );

  const itemMatch =
    normalized.match(
      new RegExp(
        `\\d+\\s*(?:${UNIT_PATTERN})\\s+of\\s+(.+?)(?=\\s+(?:delivered?|delivery|under|below|maximum|max|budget)\\b|[,.]|$)`,
        "i"
      )
    ) ??
    normalized.match(
      new RegExp(
        `(?:need|find me|buy)\\s+(?:\\d+\\s*(?:${UNIT_PATTERN})\\s+)?(.+?)(?=\\s+(?:delivered?|delivery|under|below|maximum|max|budget)\\b|[,.]|$)`,
        "i"
      )
    );

  const deadline =
    /\btomorrow\b/i.test(normalized)
      ? "tomorrow"
      : /\btoday\b/i.test(normalized)
        ? "today"
        : undefined;

  const budget = budgetMatch ? parseMoney(budgetMatch[1]) : undefined;

  return missionSchema.parse({
    id,
    type: "PROCUREMENT",
    status: "CREATED",
    rawRequest: normalized,
    item: itemMatch?.[1]?.trim() || "Requested item",
    quantity: quantityMatch ? Number(quantityMatch[1]) : undefined,
    unit: quantityMatch?.[2]?.toLowerCase(),
    budget,
    location: locationMatch?.[1]?.trim(),
    deadline,
    approvalRequired: true,
    createdAt: new Date().toISOString()
  });
}

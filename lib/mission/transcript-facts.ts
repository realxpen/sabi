import { normalizeRelativeDeadline } from "../intelligence/deadline-normalization";
import type { Mission } from "../schemas";

type TranscriptTurn = {
  speaker: "AI" | "PROVIDER";
  text: string;
};

export type TranscriptProviderFacts = {
  available?: boolean;
  quantity?: number;
  unit?: string;
  price?: number;
  deliveryFee?: number;
  total?: number;
  deliveryDate?: string;
  notes?: string;
};

function parseTurns(transcript: string): TranscriptTurn[] {
  return transcript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^(AI|assistant|User|Provider)\s*:\s*(.+)$/i);
      if (!match) return undefined;
      const speaker = /^(AI|assistant)$/i.test(match[1]) ? "AI" : "PROVIDER";
      return { speaker, text: match[2].trim() } as TranscriptTurn;
    })
    .filter((turn): turn is TranscriptTurn => Boolean(turn));
}

function isNegative(text: string): boolean {
  return /\b(?:no|not available|cannot|can't|won't|unable|do not have|don't have|not able)\b/i.test(text);
}

function isAffirmative(text: string): boolean {
  return /\b(?:yes|yeah|yep|sure|available|i can|can do|able to|i have|okay|ok)\b/i.test(text);
}

function isAvailabilityQuestion(text: string): boolean {
  return /\b(?:available|availability|can you|are you able|able to|provide|fulfil|fulfill|handle|do the job|take the job)\b/i.test(text);
}

function numericAmount(value: string): number | undefined {
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

const SMALL_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90
};

function parseSpokenNumber(value: string): number | undefined {
  const tokens = value
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter((token) => token && token !== "and");

  let total = 0;
  let current = 0;
  let sawNumber = false;

  for (const token of tokens) {
    const small = SMALL_NUMBER_WORDS[token];
    if (small !== undefined) {
      current += small;
      sawNumber = true;
      continue;
    }

    if (token === "hundred") {
      current = Math.max(current, 1) * 100;
      sawNumber = true;
      continue;
    }

    if (token === "thousand") {
      total += Math.max(current, 1) * 1_000;
      current = 0;
      sawNumber = true;
      continue;
    }

    if (token === "million") {
      total += Math.max(current, 1) * 1_000_000;
      current = 0;
      sawNumber = true;
      continue;
    }

    return undefined;
  }

  return sawNumber ? total + current : undefined;
}

function extractMoney(text: string): number | undefined {
  const currencyBefore = text.match(/(?:₦|NGN\s*)\s*([0-9][0-9,]*(?:\.\d+)?)/i);
  if (currencyBefore) return numericAmount(currencyBefore[1]);

  const currencyAfter = text.match(/([0-9][0-9,]*(?:\.\d+)?)\s*(?:naira|NGN)\b/i);
  if (currencyAfter) return numericAmount(currencyAfter[1]);

  const compactThousands = text.match(/\b([0-9]+(?:\.\d+)?)\s*[kK]\s*(?:naira|NGN)?\b/);
  if (compactThousands) {
    const base = Number(compactThousands[1]);
    if (Number.isFinite(base)) return base * 1_000;
  }

  const scaled = text.match(/\b([0-9]+(?:\.\d+)?)\s*(thousand|million)\s*(?:naira|NGN)?\b/i);
  if (scaled) {
    const base = Number(scaled[1]);
    if (!Number.isFinite(base)) return undefined;
    return base * (scaled[2].toLowerCase() === "million" ? 1_000_000 : 1_000);
  }

  const spokenCurrency = text.match(
    /\b((?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|and)[ -]*)+)\s*(?:naira|NGN)\b/i
  );
  if (spokenCurrency) return parseSpokenNumber(spokenCurrency[1]);

  return undefined;
}

function containsMissionQuantity(text: string, mission: Mission): boolean {
  if (mission.quantity === undefined) return false;
  return new RegExp(`\\b${mission.quantity}\\b`).test(text);
}

function deadlineFromEvidence(text: string, previousAi: string | undefined, mission: Mission) {
  if (!mission.deadline) return undefined;
  const normalized = normalizeRelativeDeadline(mission.deadline, mission.createdAt);
  const combined = `${previousAi ?? ""} ${text}`.toLowerCase();
  const raw = mission.deadline.toLowerCase();

  if (combined.includes(raw)) return normalized;
  if (normalized && combined.includes(normalized.toLowerCase())) return normalized;

  if (raw === "today" && /\btoday\b/i.test(combined)) return normalized;
  if (raw === "tomorrow" && /\btomorrow\b/i.test(combined)) return normalized;

  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  return iso?.[1];
}

/**
 * Strict, bounded transcript extraction for auto-progression.
 * It only promotes facts explicitly stated by the provider or explicitly
 * confirmed in response to the immediately preceding SABI question.
 */
export function extractProviderFactsFromTranscript(
  mission: Mission,
  transcript: string
): TranscriptProviderFacts {
  const turns = parseTurns(transcript);
  const facts: TranscriptProviderFacts = {};
  let previousAi: string | undefined;

  for (const turn of turns) {
    if (turn.speaker === "AI") {
      previousAi = turn.text;
      continue;
    }

    const providerText = turn.text;
    const context = `${previousAi ?? ""} ${providerText}`;

    if (isNegative(providerText) && previousAi && isAvailabilityQuestion(previousAi)) {
      facts.available = false;
    } else if (
      (previousAi && isAvailabilityQuestion(previousAi) && isAffirmative(providerText)) ||
      (!isNegative(providerText) && /\b(?:i can|i have .*available|available)\b/i.test(providerText))
    ) {
      facts.available = true;
    }

    if (
      facts.available === true &&
      mission.quantity !== undefined &&
      ((previousAi && containsMissionQuantity(previousAi, mission) && isAffirmative(providerText)) ||
        containsMissionQuantity(providerText, mission))
    ) {
      facts.quantity = mission.quantity;
      if (mission.unit) facts.unit = mission.unit;
    }

    const evidencedDeadline = deadlineFromEvidence(providerText, previousAi, mission);
    if (
      evidencedDeadline &&
      (!previousAi || isAffirmative(providerText) || providerText.toLowerCase().includes(mission.deadline?.toLowerCase() ?? ""))
    ) {
      facts.deliveryDate = evidencedDeadline;
    }

    const amount = extractMoney(providerText);
    if (amount !== undefined) {
      if (/\b(?:delivery fee|delivery charge|transport fee|transport charge)\b/i.test(context)) {
        facts.deliveryFee = amount;
      } else if (/\b(?:subtotal|before delivery|base price|service price|food price)\b/i.test(context)) {
        facts.price = amount;
      }

      if (
        /\b(?:total|all[- ]?in|including delivery|how much|cost|final amount|exact amount|price)\b/i.test(context) ||
        /\b(?:total|all[- ]?in)\b/i.test(providerText)
      ) {
        facts.total = amount;
      }
    }

    previousAi = undefined;
  }

  if (facts.available === undefined) {
    const providerText = turns
      .filter((turn) => turn.speaker === "PROVIDER")
      .map((turn) => turn.text)
      .join(" ");
    if (!isNegative(providerText) && /\b(?:i can|available|yes)\b/i.test(providerText)) {
      facts.available = true;
    }
  }

  const represented = [
    facts.available !== undefined ? `availability=${facts.available}` : undefined,
    facts.quantity !== undefined ? `quantity=${facts.quantity}${facts.unit ? ` ${facts.unit}` : ""}` : undefined,
    facts.total !== undefined ? `total=₦${facts.total.toLocaleString()}` : undefined,
    facts.price !== undefined ? `price=₦${facts.price.toLocaleString()}` : undefined,
    facts.deliveryFee !== undefined ? `deliveryFee=₦${facts.deliveryFee.toLocaleString()}` : undefined,
    facts.deliveryDate ? `fulfilment=${facts.deliveryDate}` : undefined
  ].filter(Boolean);

  if (represented.length) {
    facts.notes = `Automatically extracted from verified call transcript: ${represented.join(", ")}. Unrepresented facts remain unknown.`;
  }

  return facts;
}

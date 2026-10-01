import {
  communicationResultSchema,
  type CommunicationObservation,
  type CommunicationResult,
  type Mission
} from "../schemas";

export type TranscriptSpeaker = "SABI" | "PROVIDER" | "UNKNOWN";
export type TranscriptTurn = { speaker: TranscriptSpeaker; text: string };

export type TranscriptEvidenceField =
  | "available"
  | "price"
  | "deliveryFee"
  | "deliveryDate"
  | "quantityCapacity";

export type TranscriptEvidence = {
  field: TranscriptEvidenceField;
  value: string | number | boolean;
  providerTurnIndex: number;
  providerText: string;
  contextText?: string;
  rule:
    | "EXPLICIT_PROVIDER_STATEMENT"
    | "AFFIRMATIVE_PROVIDER_CONFIRMATION"
    | "CONTEXTUAL_NUMERIC_ANSWER";
};

export type TranscriptAmbiguityCode =
  | "UNLABELED_TRANSCRIPT"
  | "UNKNOWN_SPEAKER_CONTENT"
  | "CONFLICTING_AVAILABILITY"
  | "CONFLICTING_PRICE"
  | "CONFLICTING_DELIVERY_FEE"
  | "CONFLICTING_DELIVERY_DATE"
  | "EXISTING_OBSERVATION_PRESERVED"
  | "COMMUNICATION_NOT_COMPLETED";

export type TranscriptAmbiguity = {
  code: TranscriptAmbiguityCode;
  message: string;
};

export type TranscriptNormalizationResult = {
  status: "OBSERVATION_CREATED" | "INCOMPLETE" | "NO_PROVIDER_EVIDENCE";
  observation?: CommunicationObservation;
  turns: TranscriptTurn[];
  evidence: TranscriptEvidence[];
  ambiguities: TranscriptAmbiguity[];
  unparsedProviderTurns: TranscriptTurn[];
  unrepresentedQuantityEvidence?: {
    quantity: number;
    unit?: string;
    evidence: TranscriptEvidence[];
  };
};

export type TranscriptNormalizerOptions = { mission?: Mission };

export type CommunicationTranscriptNormalizationResult = {
  communication: CommunicationResult;
  normalization: TranscriptNormalizationResult;
  observationApplied: boolean;
};

const providerLabels = new Set([
  "provider",
  "vendor",
  "seller",
  "user",
  "customer",
  "callee",
  "recipient"
]);
const sabiLabels = new Set([
  "sabi",
  "assistant",
  "ai",
  "agent",
  "bot",
  "system"
]);
const weekdays =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

function compact(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function speakerFor(label: string): TranscriptSpeaker {
  const normalized = label.toLowerCase().trim();
  if (providerLabels.has(normalized)) return "PROVIDER";
  if (sabiLabels.has(normalized)) return "SABI";
  return "UNKNOWN";
}

export function parseRoleLabeledTranscript(rawTranscript: string): TranscriptTurn[] {
  const lines = rawTranscript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const turns: TranscriptTurn[] = [];
  const label = /^([A-Za-z][A-Za-z ]{0,24})\s*[:\-]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(label);
    if (match) {
      turns.push({ speaker: speakerFor(match[1]), text: compact(match[2]) });
      continue;
    }

    const previous = turns[turns.length - 1];
    if (previous && previous.speaker !== "UNKNOWN") {
      previous.text = compact(`${previous.text} ${line}`);
    } else {
      turns.push({ speaker: "UNKNOWN", text: compact(line) });
    }
  }

  return turns;
}

function normalizeInput(input: string | TranscriptTurn[]): TranscriptTurn[] {
  return (typeof input === "string" ? parseRoleLabeledTranscript(input) : input)
    .map((turn) => ({ speaker: turn.speaker, text: compact(turn.text) }))
    .filter((turn) => turn.text.length > 0);
}

type PromptKind =
  | "AVAILABILITY"
  | "QUANTITY_AVAILABILITY"
  | "PRICE"
  | "DELIVERY_FEE"
  | "DELIVERY_DATE"
  | undefined;

function includesMissionQuantity(text: string, mission?: Mission): boolean {
  if (mission?.quantity === undefined) return false;
  if (!new RegExp(`\\b${mission.quantity}\\b`).test(text)) return false;
  return !mission.unit || text.toLowerCase().includes(mission.unit.toLowerCase());
}

function promptKind(text: string, mission?: Mission): PromptKind {
  const lower = text.toLowerCase();
  if (
    includesMissionQuantity(text, mission) &&
    /available|in stock|do you have|can you supply|can you provide/.test(lower)
  ) {
    return "QUANTITY_AVAILABILITY";
  }
  if (/delivery|deliver/.test(lower) && /fee|cost|charge|how much/.test(lower)) {
    return "DELIVERY_FEE";
  }
  if (
    /delivery|deliver|arrive/.test(lower) &&
    new RegExp(`when|today|tomorrow|day after tomorrow|${weekdays}`, "i").test(
      lower
    )
  ) {
    return "DELIVERY_DATE";
  }
  if (/how much|price|cost/.test(lower)) return "PRICE";
  if (/available|in stock|do you have|can you supply|can you provide/.test(lower)) {
    return "AVAILABILITY";
  }
  return undefined;
}

function affirmative(text: string): boolean {
  return /^(yes|yeah|yep|sure|correct|we do|i do|we can|i can)\b/i.test(
    text.trim()
  );
}
function negative(text: string): boolean {
  return /^(no|nope|we don't|we do not|i don't|i do not|we can't|we cannot|i can't|i cannot)\b/i.test(
    text.trim()
  );
}

function explicitAvailability(text: string): boolean | undefined {
  const lower = text.toLowerCase();
  if (
    /\b(out of stock|not available|unavailable|no stock|don't have|do not have|sold out)\b/.test(
      lower
    )
  ) {
    return false;
  }
  if (
    /\b(in stock|available|we have(?: it| that| some)?|i have(?: it| that| some)?|we've got(?: it| that| some)?|we can supply|i can supply)\b/.test(
      lower
    )
  ) {
    return true;
  }
  return undefined;
}

type MoneyToken = { value: number; start: number; end: number };

function moneyValue(raw: string, k: boolean): number | undefined {
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return k ? numeric * 1000 : numeric;
}

function overlaps(a: MoneyToken, b: MoneyToken): boolean {
  return a.start < b.end && b.start < a.end;
}

function moneyTokens(text: string, allowBare: boolean): MoneyToken[] {
  const candidates: MoneyToken[] = [];
  const patterns: RegExp[] = [
    /(?:₦|NGN\s*|\bN\s*)(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/gi,
    /\b(\d+(?:\.\d+)?)\s*k\b/gi
  ];

  // The grouped alternative prevents the parser from seeing the trailing
  // `000` inside `60,000` as a separate bare amount.
  if (allowBare) {
    patterns.push(
      /\b(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d{3,}(?:\.\d+)?)\b/g
    );
  }

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      const value = moneyValue(match[1], Boolean(match[2]));
      if (value === undefined) continue;
      const candidate = {
        value,
        start: match.index,
        end: match.index + match[0].length
      };
      if (
        candidates.some(
          (existing) => existing.value === candidate.value && overlaps(existing, candidate)
        )
      ) {
        continue;
      }
      candidates.push(candidate);
    }
  }

  return candidates.sort((a, b) => a.start - b.start);
}

function clauseAround(text: string, token: MoneyToken): string {
  const lower = text.toLowerCase();
  const before = lower.slice(0, token.start);
  const after = lower.slice(token.end);
  const leftCandidates = [
    before.lastIndexOf(","),
    before.lastIndexOf(";"),
    before.lastIndexOf("."),
    before.lastIndexOf(" and ")
  ];
  const left = Math.max(...leftCandidates) + 1;
  const rightCandidates = [",", ";", ".", " and "]
    .map((separator) => after.indexOf(separator))
    .filter((index) => index >= 0);
  const right =
    rightCandidates.length > 0
      ? token.end + Math.min(...rightCandidates)
      : text.length;
  return lower.slice(left, right).trim();
}

function dateToken(text: string): string | undefined {
  const lower = text.toLowerCase();
  return (
    lower.match(/\b(day after tomorrow|tomorrow|today)\b/)?.[1] ??
    lower.match(new RegExp(`\\b(${weekdays})\\b`, "i"))?.[1]?.toLowerCase()
  );
}

function previousSabiTurn(turns: TranscriptTurn[], index: number): TranscriptTurn | undefined {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (turns[i].speaker === "SABI") return turns[i];
    if (turns[i].speaker === "PROVIDER") return undefined;
  }
  return undefined;
}

function addEvidence(target: TranscriptEvidence[], item: TranscriptEvidence): void {
  if (
    !target.some(
      (existing) =>
        existing.field === item.field &&
        existing.value === item.value &&
        existing.providerTurnIndex === item.providerTurnIndex
    )
  ) {
    target.push(item);
  }
}

function resolve<T extends string | number | boolean>(
  field: TranscriptEvidenceField,
  evidence: TranscriptEvidence[],
  code: TranscriptAmbiguityCode,
  message: string,
  ambiguities: TranscriptAmbiguity[]
): T | undefined {
  const values = [
    ...new Set(
      evidence
        .filter((item) => item.field === field)
        .map((item) => JSON.stringify(item.value))
    )
  ].map((value) => JSON.parse(value) as T);

  if (values.length === 1) return values[0];
  if (values.length > 1) ambiguities.push({ code, message });
  return undefined;
}

export function normalizeProviderTranscript(
  input: string | TranscriptTurn[],
  options: TranscriptNormalizerOptions = {}
): TranscriptNormalizationResult {
  const turns = normalizeInput(input);
  const evidence: TranscriptEvidence[] = [];
  const ambiguities: TranscriptAmbiguity[] = [];
  const used = new Set<number>();

  if (
    typeof input === "string" &&
    turns.length > 0 &&
    turns.every((turn) => turn.speaker === "UNKNOWN")
  ) {
    ambiguities.push({
      code: "UNLABELED_TRANSCRIPT",
      message: "Transcript has no recognized speaker labels, so no commercial fact was extracted."
    });
  }
  if (turns.some((turn) => turn.speaker === "UNKNOWN")) {
    ambiguities.push({
      code: "UNKNOWN_SPEAKER_CONTENT",
      message: "Unknown-speaker transcript content was excluded from factual extraction."
    });
  }

  turns.forEach((turn, index) => {
    if (turn.speaker !== "PROVIDER") return;

    const previous = previousSabiTurn(turns, index);
    const context = promptKind(previous?.text ?? "", options.mission);
    const directAvailability = explicitAvailability(turn.text);

    if (directAvailability !== undefined) {
      addEvidence(evidence, {
        field: "available",
        value: directAvailability,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "EXPLICIT_PROVIDER_STATEMENT"
      });
      used.add(index);
    } else if (
      (context === "AVAILABILITY" || context === "QUANTITY_AVAILABILITY") &&
      (affirmative(turn.text) || negative(turn.text))
    ) {
      addEvidence(evidence, {
        field: "available",
        value: affirmative(turn.text),
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "AFFIRMATIVE_PROVIDER_CONFIRMATION"
      });
      used.add(index);
    }

    if (
      options.mission?.quantity !== undefined &&
      options.mission.unit &&
      ((context === "QUANTITY_AVAILABILITY" && affirmative(turn.text)) ||
        (includesMissionQuantity(turn.text, options.mission) && directAvailability === true))
    ) {
      addEvidence(evidence, {
        field: "quantityCapacity",
        value: `${options.mission.quantity} ${options.mission.unit}`,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule:
          context === "QUANTITY_AVAILABILITY" && affirmative(turn.text)
            ? "AFFIRMATIVE_PROVIDER_CONFIRMATION"
            : "EXPLICIT_PROVIDER_STATEMENT"
      });
      used.add(index);
    }

    const tokens = moneyTokens(
      turn.text,
      context === "PRICE" || context === "DELIVERY_FEE"
    );
    const deliveryTokens = tokens.filter((token) =>
      /delivery|deliver|dispatch|fee|charge/.test(clauseAround(turn.text, token))
    );
    const productTokens = tokens.filter((token) => !deliveryTokens.includes(token));

    if (context === "DELIVERY_FEE" && tokens.length === 1) {
      addEvidence(evidence, {
        field: "deliveryFee",
        value: tokens[0].value,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "CONTEXTUAL_NUMERIC_ANSWER"
      });
      used.add(index);
    } else {
      for (const token of deliveryTokens) {
        addEvidence(evidence, {
          field: "deliveryFee",
          value: token.value,
          providerTurnIndex: index,
          providerText: turn.text,
          contextText: previous?.text,
          rule: "EXPLICIT_PROVIDER_STATEMENT"
        });
        used.add(index);
      }

      if (context === "PRICE" && productTokens.length === 1) {
        addEvidence(evidence, {
          field: "price",
          value: productTokens[0].value,
          providerTurnIndex: index,
          providerText: turn.text,
          contextText: previous?.text,
          rule: "CONTEXTUAL_NUMERIC_ANSWER"
        });
        used.add(index);
      } else {
        for (const token of productTokens) {
          if (/price|cost|ankara|fabric|yards?|material/.test(clauseAround(turn.text, token))) {
            addEvidence(evidence, {
              field: "price",
              value: token.value,
              providerTurnIndex: index,
              providerText: turn.text,
              contextText: previous?.text,
              rule: "EXPLICIT_PROVIDER_STATEMENT"
            });
            used.add(index);
          }
        }
      }
    }

    const directDate = dateToken(turn.text);
    if (
      directDate &&
      (/delivery|deliver|arrive|ready/.test(turn.text.toLowerCase()) ||
        context === "DELIVERY_DATE")
    ) {
      addEvidence(evidence, {
        field: "deliveryDate",
        value: directDate,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "EXPLICIT_PROVIDER_STATEMENT"
      });
      used.add(index);
    } else if (context === "DELIVERY_DATE" && affirmative(turn.text)) {
      const confirmedDate = dateToken(previous?.text ?? "");
      if (confirmedDate) {
        addEvidence(evidence, {
          field: "deliveryDate",
          value: confirmedDate,
          providerTurnIndex: index,
          providerText: turn.text,
          contextText: previous?.text,
          rule: "AFFIRMATIVE_PROVIDER_CONFIRMATION"
        });
        used.add(index);
      }
    }
  });

  const available = resolve<boolean>(
    "available",
    evidence,
    "CONFLICTING_AVAILABILITY",
    "Provider transcript contains conflicting availability evidence.",
    ambiguities
  );
  const price = resolve<number>(
    "price",
    evidence,
    "CONFLICTING_PRICE",
    "Provider transcript contains conflicting product-price evidence.",
    ambiguities
  );
  const deliveryFee = resolve<number>(
    "deliveryFee",
    evidence,
    "CONFLICTING_DELIVERY_FEE",
    "Provider transcript contains conflicting delivery-fee evidence.",
    ambiguities
  );
  const deliveryDate = resolve<string>(
    "deliveryDate",
    evidence,
    "CONFLICTING_DELIVERY_DATE",
    "Provider transcript contains conflicting delivery-date evidence.",
    ambiguities
  );

  const candidate: CommunicationObservation = {
    available,
    price,
    deliveryFee,
    deliveryDate
  };
  const observation = Object.values(candidate).some((value) => value !== undefined)
    ? candidate
    : undefined;
  const quantityEvidence = evidence.filter(
    (item) => item.field === "quantityCapacity"
  );
  const providerCount = turns.filter((turn) => turn.speaker === "PROVIDER").length;

  return {
    status: observation
      ? "OBSERVATION_CREATED"
      : providerCount > 0
        ? "INCOMPLETE"
        : "NO_PROVIDER_EVIDENCE",
    observation,
    turns,
    evidence,
    ambiguities,
    unparsedProviderTurns: turns.filter(
      (turn, index) => turn.speaker === "PROVIDER" && !used.has(index)
    ),
    unrepresentedQuantityEvidence:
      options.mission?.quantity !== undefined && quantityEvidence.length > 0
        ? {
            quantity: options.mission.quantity,
            unit: options.mission.unit,
            evidence: quantityEvidence
          }
        : undefined
  };
}

export function normalizeCommunicationTranscript(
  communication: CommunicationResult,
  transcript: string | TranscriptTurn[],
  options: TranscriptNormalizerOptions = {}
): CommunicationTranscriptNormalizationResult {
  const normalization = normalizeProviderTranscript(transcript, options);

  if (communication.status !== "COMPLETED") {
    normalization.ambiguities.push({
      code: "COMMUNICATION_NOT_COMPLETED",
      message: `Communication status ${communication.status} is not completed, so transcript facts were not applied.`
    });
    return { communication, normalization, observationApplied: false };
  }

  if (communication.observation !== undefined) {
    normalization.ambiguities.push({
      code: "EXISTING_OBSERVATION_PRESERVED",
      message: "Existing structured observation was preserved instead of being overwritten by transcript parsing."
    });
    return { communication, normalization, observationApplied: false };
  }

  if (!normalization.observation) {
    return { communication, normalization, observationApplied: false };
  }

  return {
    communication: communicationResultSchema.parse({
      ...communication,
      observation: normalization.observation
    }),
    normalization,
    observationApplied: true
  };
}

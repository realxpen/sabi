import {
  communicationResultSchema,
  type CommunicationObservation,
  type CommunicationResult,
  type Mission
} from "../schemas";

export type TranscriptSpeaker = "SABI" | "PROVIDER" | "UNKNOWN";

export type TranscriptTurn = {
  speaker: TranscriptSpeaker;
  text: string;
};

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

export type TranscriptNormalizationStatus =
  | "OBSERVATION_CREATED"
  | "INCOMPLETE"
  | "NO_PROVIDER_EVIDENCE";

export type TranscriptNormalizationResult = {
  status: TranscriptNormalizationStatus;
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

export type TranscriptNormalizerOptions = {
  mission?: Mission;
};

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

const weekdayPattern =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function speakerForLabel(label: string): TranscriptSpeaker {
  const normalized = label.trim().toLowerCase();
  if (providerLabels.has(normalized)) return "PROVIDER";
  if (sabiLabels.has(normalized)) return "SABI";
  return "UNKNOWN";
}

/**
 * Parses common role-labelled transcript text such as `AI: ...` / `User: ...`.
 * Unlabelled transcript text is intentionally left UNKNOWN because extracting
 * commercial facts without knowing which speaker said them would risk turning
 * SABI's own questions into provider evidence.
 */
export function parseRoleLabeledTranscript(rawTranscript: string): TranscriptTurn[] {
  const lines = rawTranscript
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const turns: TranscriptTurn[] = [];
  const labelPattern = /^([A-Za-z][A-Za-z ]{0,24})\s*[:\-]\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(labelPattern);
    if (match) {
      const speaker = speakerForLabel(match[1]);
      turns.push({ speaker, text: normalizeWhitespace(match[2]) });
      continue;
    }

    const previous = turns.at(-1);
    if (previous && previous.speaker !== "UNKNOWN") {
      previous.text = normalizeWhitespace(`${previous.text} ${line}`);
    } else {
      turns.push({ speaker: "UNKNOWN", text: normalizeWhitespace(line) });
    }
  }

  return turns;
}

function normalizeTranscriptInput(
  input: string | TranscriptTurn[]
): TranscriptTurn[] {
  if (typeof input === "string") {
    return parseRoleLabeledTranscript(input);
  }

  return input
    .map((turn) => ({
      speaker: turn.speaker,
      text: normalizeWhitespace(turn.text)
    }))
    .filter((turn) => turn.text.length > 0);
}

type PromptContext =
  | "AVAILABILITY"
  | "QUANTITY_AVAILABILITY"
  | "PRICE"
  | "DELIVERY_FEE"
  | "DELIVERY_DATE"
  | undefined;

function includesMissionQuantity(text: string, mission: Mission | undefined): boolean {
  if (mission?.quantity === undefined) return false;
  const quantityPattern = new RegExp(`\\b${mission.quantity}\\b`, "i");
  if (!quantityPattern.test(text)) return false;
  if (!mission.unit) return true;
  return text.toLowerCase().includes(mission.unit.toLowerCase());
}

function classifyPrompt(text: string, mission: Mission | undefined): PromptContext {
  const lower = text.toLowerCase();

  if (
    includesMissionQuantity(text, mission) &&
    /available|in stock|do you have|have that|can you supply|can you provide/.test(lower)
  ) {
    return "QUANTITY_AVAILABILITY";
  }

  if (
    /delivery|deliver/.test(lower) &&
    /fee|cost|charge|how much/.test(lower)
  ) {
    return "DELIVERY_FEE";
  }

  if (
    /delivery|deliver|arrive/.test(lower) &&
    new RegExp(`when|today|tomorrow|day after tomorrow|${weekdayPattern}`, "i").test(
      lower
    )
  ) {
    return "DELIVERY_DATE";
  }

  if (/how much|price|cost/.test(lower)) {
    return "PRICE";
  }

  if (/available|in stock|do you have|have that|can you supply|can you provide/.test(lower)) {
    return "AVAILABILITY";
  }

  return undefined;
}

function isAffirmative(text: string): boolean {
  return /^(yes|yeah|yep|sure|correct|we do|i do|we can|i can)\b/i.test(
    text.trim()
  );
}

function isNegative(text: string): boolean {
  return /^(no|nope|we don't|we do not|i don't|i do not|we can't|we cannot|i can't|i cannot)\b/i.test(
    text.trim()
  );
}

function explicitAvailability(text: string): boolean | undefined {
  const lower = text.toLowerCase();

  if (
    /\b(out of stock|not available|unavailable|no stock|don't have|do not have|don't stock|do not stock|sold out)\b/.test(
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

function parseMoneyValue(raw: string, kSuffix: boolean): number | undefined {
  const numeric = Number(raw.replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;
  return kSuffix ? numeric * 1000 : numeric;
}

function moneyTokens(text: string, allowBareAmount: boolean): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  const seen = new Set<string>();

  const patterns: RegExp[] = [
    /(?:₦|NGN\s*|\bN\s*)(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/gi,
    /\b(\d+(?:\.\d+)?)\s*k\b/gi
  ];

  if (allowBareAmount) {
    patterns.push(/\b(\d{3,}(?:,\d{3})*(?:\.\d+)?)\b/g);
  }

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined) continue;
      const value = parseMoneyValue(match[1], Boolean(match[2]));
      if (value === undefined) continue;
      const start = match.index;
      const end = start + match[0].length;
      const key = `${start}:${end}:${value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push({ value, start, end });
    }
  }

  return tokens.sort((a, b) => a.start - b.start);
}

function tokenWindow(text: string, token: MoneyToken): string {
  return text
    .slice(Math.max(0, token.start - 36), Math.min(text.length, token.end + 36))
    .toLowerCase();
}

function extractDateToken(text: string): string | undefined {
  const lower = text.toLowerCase();
  const relative = lower.match(/\b(day after tomorrow|tomorrow|today)\b/i)?.[1];
  if (relative) return relative.toLowerCase();

  const weekday = lower.match(new RegExp(`\\b(${weekdayPattern})\\b`, "i"))?.[1];
  return weekday?.toLowerCase();
}

function pushEvidence(
  target: TranscriptEvidence[],
  evidence: TranscriptEvidence
): void {
  const duplicate = target.some(
    (item) =>
      item.field === evidence.field &&
      item.value === evidence.value &&
      item.providerTurnIndex === evidence.providerTurnIndex
  );
  if (!duplicate) target.push(evidence);
}

function resolveField<T extends string | number | boolean>(
  field: TranscriptEvidenceField,
  evidence: TranscriptEvidence[],
  ambiguityCode: TranscriptAmbiguityCode,
  ambiguityMessage: string,
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
  if (values.length > 1) {
    ambiguities.push({ code: ambiguityCode, message: ambiguityMessage });
  }
  return undefined;
}

function previousSabiTurn(
  turns: TranscriptTurn[],
  providerTurnIndex: number
): TranscriptTurn | undefined {
  for (let index = providerTurnIndex - 1; index >= 0; index -= 1) {
    if (turns[index].speaker === "SABI") return turns[index];
    if (turns[index].speaker === "PROVIDER") return undefined;
  }
  return undefined;
}

export function normalizeProviderTranscript(
  input: string | TranscriptTurn[],
  options: TranscriptNormalizerOptions = {}
): TranscriptNormalizationResult {
  const turns = normalizeTranscriptInput(input);
  const evidence: TranscriptEvidence[] = [];
  const ambiguities: TranscriptAmbiguity[] = [];
  const usedProviderTurnIndexes = new Set<number>();

  if (
    typeof input === "string" &&
    turns.length > 0 &&
    turns.every((turn) => turn.speaker === "UNKNOWN")
  ) {
    ambiguities.push({
      code: "UNLABELED_TRANSCRIPT",
      message:
        "Transcript has no recognized speaker labels, so no commercial fact was extracted."
    });
  }

  if (turns.some((turn) => turn.speaker === "UNKNOWN")) {
    ambiguities.push({
      code: "UNKNOWN_SPEAKER_CONTENT",
      message:
        "Some transcript content has an unknown speaker and was excluded from factual extraction."
    });
  }

  turns.forEach((turn, index) => {
    if (turn.speaker !== "PROVIDER") return;

    const previous = previousSabiTurn(turns, index);
    const context = classifyPrompt(previous?.text ?? "", options.mission);
    const directAvailability = explicitAvailability(turn.text);

    if (directAvailability !== undefined) {
      pushEvidence(evidence, {
        field: "available",
        value: directAvailability,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "EXPLICIT_PROVIDER_STATEMENT"
      });
      usedProviderTurnIndexes.add(index);
    } else if (
      context === "AVAILABILITY" ||
      context === "QUANTITY_AVAILABILITY"
    ) {
      if (isAffirmative(turn.text) || isNegative(turn.text)) {
        pushEvidence(evidence, {
          field: "available",
          value: isAffirmative(turn.text),
          providerTurnIndex: index,
          providerText: turn.text,
          contextText: previous?.text,
          rule: "AFFIRMATIVE_PROVIDER_CONFIRMATION"
        });
        usedProviderTurnIndexes.add(index);
      }
    }

    if (
      options.mission?.quantity !== undefined &&
      options.mission.unit &&
      ((context === "QUANTITY_AVAILABILITY" && isAffirmative(turn.text)) ||
        (includesMissionQuantity(turn.text, options.mission) &&
          directAvailability === true))
    ) {
      pushEvidence(evidence, {
        field: "quantityCapacity",
        value: `${options.mission.quantity} ${options.mission.unit}`,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule:
          context === "QUANTITY_AVAILABILITY" && isAffirmative(turn.text)
            ? "AFFIRMATIVE_PROVIDER_CONFIRMATION"
            : "EXPLICIT_PROVIDER_STATEMENT"
      });
      usedProviderTurnIndexes.add(index);
    }

    const allowBareMoney = context === "PRICE" || context === "DELIVERY_FEE";
    const tokens = moneyTokens(turn.text, allowBareMoney);

    if (tokens.length > 0) {
      const deliveryTokens = tokens.filter((token) =>
        /delivery|deliver|dispatch|fee|charge/.test(tokenWindow(turn.text, token))
      );
      const nonDeliveryTokens = tokens.filter(
        (token) => !deliveryTokens.includes(token)
      );

      if (context === "DELIVERY_FEE") {
        if (tokens.length === 1) {
          pushEvidence(evidence, {
            field: "deliveryFee",
            value: tokens[0].value,
            providerTurnIndex: index,
            providerText: turn.text,
            contextText: previous?.text,
            rule: "CONTEXTUAL_NUMERIC_ANSWER"
          });
          usedProviderTurnIndexes.add(index);
        }
      } else {
        for (const token of deliveryTokens) {
          pushEvidence(evidence, {
            field: "deliveryFee",
            value: token.value,
            providerTurnIndex: index,
            providerText: turn.text,
            contextText: previous?.text,
            rule: "EXPLICIT_PROVIDER_STATEMENT"
          });
          usedProviderTurnIndexes.add(index);
        }

        if (context === "PRICE" && nonDeliveryTokens.length === 1) {
          pushEvidence(evidence, {
            field: "price",
            value: nonDeliveryTokens[0].value,
            providerTurnIndex: index,
            providerText: turn.text,
            contextText: previous?.text,
            rule: "CONTEXTUAL_NUMERIC_ANSWER"
          });
          usedProviderTurnIndexes.add(index);
        } else {
          for (const token of nonDeliveryTokens) {
            const window = tokenWindow(turn.text, token);
            if (/price|cost|ankara|fabric|yards?|material/.test(window)) {
              pushEvidence(evidence, {
                field: "price",
                value: token.value,
                providerTurnIndex: index,
                providerText: turn.text,
                contextText: previous?.text,
                rule: "EXPLICIT_PROVIDER_STATEMENT"
              });
              usedProviderTurnIndexes.add(index);
            }
          }
        }
      }
    }

    const directDate = extractDateToken(turn.text);
    if (
      directDate &&
      (/delivery|deliver|arrive|ready/.test(turn.text.toLowerCase()) ||
        context === "DELIVERY_DATE")
    ) {
      pushEvidence(evidence, {
        field: "deliveryDate",
        value: directDate,
        providerTurnIndex: index,
        providerText: turn.text,
        contextText: previous?.text,
        rule: "EXPLICIT_PROVIDER_STATEMENT"
      });
      usedProviderTurnIndexes.add(index);
    } else if (context === "DELIVERY_DATE" && isAffirmative(turn.text)) {
      const contextDate = extractDateToken(previous?.text ?? "");
      if (contextDate) {
        pushEvidence(evidence, {
          field: "deliveryDate",
          value: contextDate,
          providerTurnIndex: index,
          providerText: turn.text,
          contextText: previous?.text,
          rule: "AFFIRMATIVE_PROVIDER_CONFIRMATION"
        });
        usedProviderTurnIndexes.add(index);
      }
    }
  });

  const available = resolveField<boolean>(
    "available",
    evidence,
    "CONFLICTING_AVAILABILITY",
    "Provider transcript contains conflicting availability evidence.",
    ambiguities
  );
  const price = resolveField<number>(
    "price",
    evidence,
    "CONFLICTING_PRICE",
    "Provider transcript contains conflicting product-price evidence.",
    ambiguities
  );
  const deliveryFee = resolveField<number>(
    "deliveryFee",
    evidence,
    "CONFLICTING_DELIVERY_FEE",
    "Provider transcript contains conflicting delivery-fee evidence.",
    ambiguities
  );
  const deliveryDate = resolveField<string>(
    "deliveryDate",
    evidence,
    "CONFLICTING_DELIVERY_DATE",
    "Provider transcript contains conflicting delivery-date evidence.",
    ambiguities
  );

  const observationCandidate: CommunicationObservation = {
    available,
    price,
    deliveryFee,
    deliveryDate
  };

  const observation = Object.values(observationCandidate).some(
    (value) => value !== undefined
  )
    ? observationCandidate
    : undefined;

  const quantityEvidence = evidence.filter(
    (item) => item.field === "quantityCapacity"
  );

  const unrepresentedQuantityEvidence =
    options.mission?.quantity !== undefined && quantityEvidence.length > 0
      ? {
          quantity: options.mission.quantity,
          unit: options.mission.unit,
          evidence: quantityEvidence
        }
      : undefined;

  const providerTurnCount = turns.filter(
    (turn) => turn.speaker === "PROVIDER"
  ).length;

  return {
    status:
      observation !== undefined
        ? "OBSERVATION_CREATED"
        : providerTurnCount > 0
          ? "INCOMPLETE"
          : "NO_PROVIDER_EVIDENCE",
    observation,
    turns,
    evidence,
    ambiguities,
    unparsedProviderTurns: turns.filter(
      (turn, index) =>
        turn.speaker === "PROVIDER" && !usedProviderTurnIndexes.has(index)
    ),
    unrepresentedQuantityEvidence
  };
}

/**
 * Applies transcript-derived observation data to a canonical CommunicationResult
 * only when the communication is COMPLETED and no structured observation already
 * exists. This prevents transcript extraction from silently overwriting adapter-
 * supplied structured evidence.
 */
export function normalizeCommunicationTranscript(
  communication: CommunicationResult,
  transcript: string | TranscriptTurn[],
  options: TranscriptNormalizerOptions = {}
): CommunicationTranscriptNormalizationResult {
  const normalization = normalizeProviderTranscript(transcript, options);

  if (communication.status !== "COMPLETED") {
    normalization.ambiguities.push({
      code: "COMMUNICATION_NOT_COMPLETED",
      message:
        `Communication status ${communication.status} is not completed, so transcript facts were not applied.`
    });
    return {
      communication,
      normalization,
      observationApplied: false
    };
  }

  if (communication.observation !== undefined) {
    normalization.ambiguities.push({
      code: "EXISTING_OBSERVATION_PRESERVED",
      message:
        "Communication already contains structured observation data, so transcript normalization did not overwrite it."
    });
    return {
      communication,
      normalization,
      observationApplied: false
    };
  }

  if (normalization.observation === undefined) {
    return {
      communication,
      normalization,
      observationApplied: false
    };
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

import { z } from "zod";

export const spitchLanguageSchema = z.enum([
  "en",
  "yo",
  "ha",
  "ig",
  "am",
  "pcm"
]);

export type SpitchLanguage = z.infer<typeof spitchLanguageSchema>;

export const spitchSupportedLanguages = spitchLanguageSchema.options;

const translationResponseSchema = z.object({
  request_id: z.string().trim().min(1),
  text: z.string()
}).passthrough();

const transcriptionResponseSchema = z.object({
  request_id: z.string().trim().min(1),
  text: z.string(),
  segments: z.unknown().optional()
}).passthrough();

const speechFormatSchema = z.enum([
  "wav",
  "mp3",
  "ogg_opus",
  "webm_opus",
  "flac",
  "pcm_s16le",
  "mulaw",
  "alaw"
]);

const translationInputSchema = z.object({
  text: z.string().trim().min(1),
  target: spitchLanguageSchema,
  source: spitchLanguageSchema.optional(),
  tone: z.enum(["neutral", "warm", "professional", "narration"]).optional(),
  formality: z.enum(["casual", "formal"]).optional()
});

const transcriptionInputSchema = z.object({
  content: z.instanceof(Blob),
  filename: z.string().trim().min(1).default("audio.wav"),
  language: spitchLanguageSchema.optional(),
  timestamp: z.enum(["sentence", "word"]).optional()
});

const speechInputSchema = z.object({
  text: z.string().trim().min(1),
  voice: z.string().trim().min(1),
  language: spitchLanguageSchema.optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  format: speechFormatSchema.optional()
});

export type SpitchTranslationInput = z.input<typeof translationInputSchema>;
export type SpitchTranscriptionInput = z.input<typeof transcriptionInputSchema>;
export type SpitchSpeechInput = z.input<typeof speechInputSchema>;

export type SpitchEnvironment = {
  [key: string]: string | undefined;
};

export type SpitchFetch = typeof fetch;

type SpitchConfiguration = {
  apiBaseUrl: string;
  apiKey: string;
};

export class SpitchConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpitchConfigurationError";
  }
}

export class SpitchHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SpitchHttpError";
  }
}

export function readSpitchConfiguration(
  environment: SpitchEnvironment = process.env
): SpitchConfiguration {
  const parsed = z
    .object({
      apiBaseUrl: z.string().url(),
      apiKey: z.string().trim().min(1)
    })
    .safeParse({
      apiBaseUrl:
        environment.SPITCH_API_BASE_URL?.trim() ||
        "https://api.spitch.app",
      apiKey: environment.SPITCH_API_KEY
    });

  if (!parsed.success) {
    throw new SpitchConfigurationError(
      "Spitch requires SPITCH_API_KEY. SPITCH_API_BASE_URL may override the current https://api.spitch.app base URL."
    );
  }

  return {
    apiBaseUrl: parsed.data.apiBaseUrl.replace(/\/+$/, ""),
    apiKey: parsed.data.apiKey
  };
}

export class SpitchHttpClient {
  private readonly configuration: SpitchConfiguration;

  constructor(
    environment: SpitchEnvironment = process.env,
    private readonly fetchImpl: SpitchFetch = fetch
  ) {
    this.configuration = readSpitchConfiguration(environment);
  }

  private headers(contentType = true): HeadersInit {
    return {
      Authorization: `Bearer ${this.configuration.apiKey}`,
      Accept: "*/*",
      ...(contentType ? { "Content-Type": "application/json" } : {})
    };
  }

  async translate(input: SpitchTranslationInput): Promise<{
    requestId: string;
    text: string;
  }> {
    const body = translationInputSchema.parse(input);

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.configuration.apiBaseUrl}/v1/translate`,
        {
          method: "POST",
          headers: this.headers(),
          cache: "no-store",
          body: JSON.stringify(body)
        }
      );
    } catch {
      throw new SpitchHttpError("Spitch translation request failed.");
    }

    if (!response.ok) {
      throw new SpitchHttpError(
        `Spitch translation failed with HTTP ${response.status}.`
      );
    }

    try {
      const parsed = translationResponseSchema.parse(await response.json());
      return { requestId: parsed.request_id, text: parsed.text };
    } catch {
      throw new SpitchHttpError("Spitch returned an invalid translation response.");
    }
  }

  async transcribe(input: SpitchTranscriptionInput): Promise<{
    requestId: string;
    text: string;
    segments?: unknown;
  }> {
    const parsedInput = transcriptionInputSchema.parse(input);
    const form = new FormData();
    form.append("content", parsedInput.content, parsedInput.filename);
    if (parsedInput.language) form.append("language", parsedInput.language);
    if (parsedInput.timestamp) form.append("timestamp", parsedInput.timestamp);

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.configuration.apiBaseUrl}/v1/transcriptions`,
        {
          method: "POST",
          headers: this.headers(false),
          cache: "no-store",
          body: form
        }
      );
    } catch {
      throw new SpitchHttpError("Spitch transcription request failed.");
    }

    if (!response.ok) {
      throw new SpitchHttpError(
        `Spitch transcription failed with HTTP ${response.status}.`
      );
    }

    try {
      const parsed = transcriptionResponseSchema.parse(await response.json());
      return {
        requestId: parsed.request_id,
        text: parsed.text,
        segments: parsed.segments
      };
    } catch {
      throw new SpitchHttpError(
        "Spitch returned an invalid transcription response."
      );
    }
  }

  async generateSpeech(input: SpitchSpeechInput): Promise<{
    audio: Uint8Array;
    contentType: string;
  }> {
    const body = speechInputSchema.parse(input);

    let response: Response;
    try {
      response = await this.fetchImpl(
        `${this.configuration.apiBaseUrl}/v1/speech`,
        {
          method: "POST",
          headers: this.headers(),
          cache: "no-store",
          body: JSON.stringify(body)
        }
      );
    } catch {
      throw new SpitchHttpError("Spitch speech generation request failed.");
    }

    if (!response.ok) {
      throw new SpitchHttpError(
        `Spitch speech generation failed with HTTP ${response.status}.`
      );
    }

    return {
      audio: new Uint8Array(await response.arrayBuffer()),
      contentType:
        response.headers.get("content-type") ?? "application/octet-stream"
    };
  }
}

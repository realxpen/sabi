import { describe, expect, it } from "vitest";
import {
  SpitchHttpClient,
  spitchLanguageSchema,
  spitchSupportedLanguages
} from "../lib/integrations/voice-runtime/spitch";
import {
  getLiveKitSpitchReadiness
} from "../lib/integrations/voice-runtime/livekit-spitch";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("Spitch HTTP primitives", () => {
  it("keeps the verified African language set explicit", () => {
    expect(spitchSupportedLanguages).toEqual([
      "en",
      "yo",
      "ha",
      "ig",
      "am",
      "pcm"
    ]);
    expect(spitchLanguageSchema.safeParse("yo").success).toBe(true);
    expect(spitchLanguageSchema.safeParse("fr").success).toBe(false);
  });

  it("uses the documented translation endpoint and Bearer auth", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchStub = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      calls.push({ url: String(input), init });
      return jsonResponse({
        request_id: "req-translate",
        text: "Bawo ni?"
      });
    }) as typeof fetch;

    const client = new SpitchHttpClient(
      {
        SPITCH_API_BASE_URL: "https://api.spitch.app",
        SPITCH_API_KEY: "private-test-key"
      },
      fetchStub
    );

    const result = await client.translate({
      text: "How are you?",
      source: "en",
      target: "yo",
      tone: "warm",
      formality: "casual"
    });

    expect(result).toEqual({
      requestId: "req-translate",
      text: "Bawo ni?"
    });
    expect(calls[0]?.url).toBe(
      "https://api.spitch.app/v1/translate"
    );
    expect(calls[0]?.init?.headers).toMatchObject({
      Authorization: "Bearer private-test-key",
      "Content-Type": "application/json"
    });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      text: "How are you?",
      source: "en",
      target: "yo",
      tone: "warm",
      formality: "casual"
    });
  });

  it("uses multipart content for the documented transcription endpoint", async () => {
    let capturedBody: BodyInit | null | undefined;
    const fetchStub = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      expect(String(input)).toBe(
        "https://api.spitch.app/v1/transcriptions"
      );
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer private-test-key"
      });
      const headers = init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
      capturedBody = init?.body;
      return jsonResponse({
        request_id: "req-stt",
        text: "E kaaro",
        segments: null
      });
    }) as typeof fetch;

    const client = new SpitchHttpClient(
      { SPITCH_API_KEY: "private-test-key" },
      fetchStub
    );

    const result = await client.transcribe({
      content: new Blob(["fake-audio"], { type: "audio/wav" }),
      filename: "sample.wav",
      language: "yo",
      timestamp: "word"
    });

    expect(result.requestId).toBe("req-stt");
    expect(result.text).toBe("E kaaro");
    expect(capturedBody).toBeInstanceOf(FormData);

    const form = capturedBody as FormData;
    expect(form.get("language")).toBe("yo");
    expect(form.get("timestamp")).toBe("word");
    expect(form.get("content")).toBeInstanceOf(Blob);
  });

  it("returns speech bytes from the documented TTS endpoint", async () => {
    const fetchStub = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      expect(String(input)).toBe("https://api.spitch.app/v1/speech");
      expect(JSON.parse(String(init?.body))).toEqual({
        text: "Bawo ni?",
        voice: "femi",
        language: "yo",
        speed: 1,
        format: "mulaw"
      });
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "Content-Type": "audio/basic" }
      });
    }) as typeof fetch;

    const client = new SpitchHttpClient(
      { SPITCH_API_KEY: "private-test-key" },
      fetchStub
    );
    const result = await client.generateSpeech({
      text: "Bawo ni?",
      voice: "femi",
      language: "yo",
      speed: 1,
      format: "mulaw"
    });

    expect(Array.from(result.audio)).toEqual([1, 2, 3]);
    expect(result.contentType).toBe("audio/basic");
  });
});

describe("LiveKit + Spitch pre-live readiness", () => {
  it("is disabled by default even if credentials happen to exist", () => {
    const readiness = getLiveKitSpitchReadiness({
      SPITCH_API_KEY: "spitch",
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_AGENT_NAME: "sabi-african-voice",
      LIVEKIT_SIP_TRUNK_ID: "trunk"
    });

    expect(readiness.mode).toBe("disabled");
    expect(readiness.configured).toBe(true);
    expect(readiness.readyForExternalAgentProof).toBe(false);
    expect(readiness.requiresExternalAgentRuntime).toBe(true);
  });

  it("becomes ready for external agent proof only with explicit mode and full config", () => {
    const readiness = getLiveKitSpitchReadiness({
      SABI_AFRICAN_VOICE_MODE: "livekit-spitch",
      SPITCH_API_KEY: "spitch",
      LIVEKIT_URL: "wss://example.livekit.cloud",
      LIVEKIT_API_KEY: "key",
      LIVEKIT_API_SECRET: "secret",
      LIVEKIT_AGENT_NAME: "sabi-african-voice",
      LIVEKIT_SIP_TRUNK_ID: "trunk"
    });

    expect(readiness.enabled).toBe(true);
    expect(readiness.configured).toBe(true);
    expect(readiness.readyForExternalAgentProof).toBe(true);
  });
});

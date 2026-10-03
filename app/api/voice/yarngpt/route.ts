import { randomUUID } from "node:crypto";
import { z } from "zod";

export const runtime = "nodejs";
export const maxDuration = 30;

const requestSchema = z.object({
  text: z.string().trim().min(1).max(1200)
});

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}

function readConfiguration() {
  const apiKey = process.env.YARNGPT_API_KEY?.trim();
  if (!apiKey) return undefined;

  const baseUrl = (
    process.env.YARNGPT_API_BASE_URL?.trim() || "https://api.yarngpt.ai"
  ).replace(/\/$/, "");
  const voice = process.env.YARNGPT_VOICE?.trim() || undefined;

  return { apiKey, baseUrl, voice };
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) {
    return Response.json({ error: "INVALID_ORIGIN" }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return Response.json(
      { error: "INVALID_VOICE_INPUT", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const configuration = readConfiguration();
  if (!configuration) {
    return Response.json(
      {
        error: "YARNGPT_NOT_CONFIGURED",
        message: "YarnGPT voice is not configured."
      },
      { status: 503 }
    );
  }

  const body: Record<string, string> = {
    text: parsed.data.text,
    output_format: "mp3"
  };
  if (configuration.voice) body.voice = configuration.voice;

  let upstream: Response;
  try {
    upstream = await fetch(
      `${configuration.baseUrl}/api/v1/streaming/conversation`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${configuration.apiKey}`,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
          "Idempotency-Key": `sabi-${randomUUID()}`
        },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(25_000)
      }
    );
  } catch (error) {
    console.error("YarnGPT voice request failed before response", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return Response.json({ error: "YARNGPT_UNAVAILABLE" }, { status: 502 });
  }

  if (!upstream.ok) {
    console.error("YarnGPT voice request rejected", {
      status: upstream.status,
      requestId: upstream.headers.get("x-request-id") ?? undefined
    });
    return Response.json(
      { error: "YARNGPT_REJECTED", status: upstream.status },
      { status: 502 }
    );
  }

  const audio = await upstream.arrayBuffer();
  if (audio.byteLength === 0) {
    console.error("YarnGPT returned an empty audio response", {
      requestId: upstream.headers.get("x-request-id") ?? undefined
    });
    return Response.json({ error: "YARNGPT_EMPTY_AUDIO" }, { status: 502 });
  }

  return new Response(audio, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "audio/mpeg",
      "Cache-Control": "no-store",
      "X-SABI-Voice-Provider": "YarnGPT"
    }
  });
}

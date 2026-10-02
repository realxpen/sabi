import { bimpeToolManifest } from "../../../../lib/integrations/bimpe/tool-manifest";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") {
    return new Response(null, { status: 404 });
  }

  const baseUrl = process.env.SABI_PUBLIC_BASE_URL?.trim();

  return Response.json({
    environment: "preview",
    baseUrlConfigured: Boolean(baseUrl),
    tools: bimpeToolManifest.map((tool) => ({
      ...tool,
      absoluteUrl: baseUrl ? `${baseUrl.replace(/\/$/, "")}${tool.path}` : undefined
    })),
    auth: {
      scheme: "Bearer",
      configured: Boolean(process.env.SABI_AGENT_TOOL_TOKEN?.trim()),
      tokenExposed: false
    }
  });
}

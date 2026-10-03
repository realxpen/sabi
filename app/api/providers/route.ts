import { ZodError } from "zod";
import {
  createRegisteredProvider,
  createRegisteredProviderInputSchema,
  listRegisteredProviders
} from "../../../lib/integrations/neon/provider-registry";

export const runtime = "nodejs";

export async function GET() {
  try {
    const providers = await listRegisteredProviders({ active: true });
    return Response.json({ data: providers, phoneNumbersExposed: false });
  } catch (error) {
    console.error("Failed to list registered providers", error);
    return Response.json(
      { error: "PROVIDER_REGISTRY_UNAVAILABLE" },
      { status: 503 }
    );
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const input = createRegisteredProviderInputSchema.parse(body);
    const provider = await createRegisteredProvider(input);

    return Response.json(
      {
        data: provider,
        persisted: true,
        liveContactConsented: true,
        phoneNumberExposed: false
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_PROVIDER_INPUT", details: error.flatten() },
        { status: 400 }
      );
    }

    console.error("Failed to add provider", error);
    return Response.json(
      { error: "PROVIDER_REGISTRY_UNAVAILABLE" },
      { status: 503 }
    );
  }
}

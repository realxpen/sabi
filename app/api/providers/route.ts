import { ZodError } from "zod";
import {
  createRegisteredProvider,
  createRegisteredProviderInputSchema,
  listRegisteredProviders,
  updateRegisteredProvider,
  updateRegisteredProviderInputSchema
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

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({}));

  try {
    const input = updateRegisteredProviderInputSchema.parse(body);
    const provider = await updateRegisteredProvider(input);

    return Response.json({
      data: provider,
      persisted: true,
      liveContactConsented: true,
      phoneNumberExposed: false
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return Response.json(
        { error: "INVALID_PROVIDER_INPUT", details: error.flatten() },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message === "PROVIDER_NOT_FOUND") {
      return Response.json({ error: "PROVIDER_NOT_FOUND" }, { status: 404 });
    }

    if (error instanceof Error && error.message === "PROVIDER_EDIT_PHONE_MISMATCH") {
      return Response.json(
        {
          error: "PROVIDER_EDIT_PHONE_MISMATCH",
          message: "The current phone number did not match this vendor."
        },
        { status: 403 }
      );
    }

    console.error("Failed to update provider", error);
    return Response.json(
      { error: "PROVIDER_REGISTRY_UNAVAILABLE" },
      { status: 503 }
    );
  }
}

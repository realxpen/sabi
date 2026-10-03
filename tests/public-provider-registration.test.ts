import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/integrations/neon/provider-registry", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/integrations/neon/provider-registry")>()),
  createRegisteredProvider: vi.fn()
}));

import { POST } from "../app/api/providers/route";
import { createRegisteredProvider } from "../lib/integrations/neon/provider-registry";

const input = {
  name: "Public Vendor", category: "Perfume", location: "Lagos",
  phone: "08012345678", languages: ["English"], consentedToLiveContact: true
};
const request = (body: unknown) => new Request("https://sabi.example/api/providers", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

describe("public provider registration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("registers without operator credentials and returns only public provider fields", async () => {
    vi.mocked(createRegisteredProvider).mockResolvedValue({
      id: "provider-public", name: input.name, category: input.category,
      location: input.location, languages: input.languages, verified: false, active: true
    });
    const response = await POST(request(input));
    expect(response.status).toBe(201);
    expect(createRegisteredProvider).toHaveBeenCalledWith(input);
    const body = await response.json();
    expect(body.phoneNumberExposed).toBe(false);
    expect(body.data).not.toHaveProperty("phone");
  });

  it.each([false, undefined])("rejects consent %s before persisting", async (consent) => {
    const response = await POST(request({ ...input, consentedToLiveContact: consent }));
    expect(response.status).toBe(400);
    expect(createRegisteredProvider).not.toHaveBeenCalled();
  });
});

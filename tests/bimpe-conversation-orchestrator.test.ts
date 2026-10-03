import { describe, expect, it, vi } from "vitest";
import {
  missionChannelUserId,
  resumeBimpeMissionAfterCommunication,
  startBimpeMissionOrchestration
} from "../lib/integrations/bimpe/conversation-orchestrator";

const environment = {
  BIMPEAI_API_KEY: "sk_test_bimpe",
  BIMPEAI_BASE_URL: "https://api.bimpe.ai/api/v1/console",
  BIMPEAI_AGENT_ID: "agent-sabi",
  BIMPEAI_ORCHESTRATION_TEST_CHANNEL: "false"
};

describe("Bimpe mission conversation orchestration", () => {
  it("derives one stable Bimpe webchat UUID from SABI mission IDs", () => {
    expect(
      missionChannelUserId(
        "mission-bimpe-2383efcf-5c2c-4974-a91a-21b918081be3"
      )
    ).toBe("2383efcf-5c2c-4974-a91a-21b918081be3");

    expect(
      missionChannelUserId("mission-0c514e7e-57f1-4373-89e5-4bb83a64a853")
    ).toBe("0c514e7e-57f1-4373-89e5-4bb83a64a853");
  });

  it("hands an existing live mission to Bimpe without asking it to create another mission", async () => {
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      expect(String(url)).toBe(
        "https://api.bimpe.ai/api/v1/console/agents/agent-sabi/conversations/messages"
      );

      const headers = new Headers(init?.headers);
      expect(headers.get("authorization")).toBe("Bearer sk_test_bimpe");
      expect(headers.get("x-request-id")).toContain("sabi-bimpe-start-");

      const body = JSON.parse(String(init?.body));
      expect(body.channel_type).toBe("webchat");
      expect(body.channel_user_id).toBe(
        "0c514e7e-57f1-4373-89e5-4bb83a64a853"
      );
      expect(body.is_test_channel).toBe(false);
      expect(body.message).toContain("Do not create a new mission");
      expect(body.message).toContain("Get Mission State");
      expect(body.message).toContain("Call Provider");
      expect(body.message).toContain("mode LIVE");

      return Response.json(
        {
          message: "Success",
          data: {
            id: "message-1",
            role: "assistant",
            message: "Mission accepted",
            created_at: "2026-10-03T06:30:00.000Z"
          }
        },
        { status: 201 }
      );
    }) as typeof fetch;

    const result = await startBimpeMissionOrchestration(
      {
        missionId: "mission-0c514e7e-57f1-4373-89e5-4bb83a64a853",
        request: "Find a photographer in Lagos tomorrow under ₦80,000."
      },
      environment,
      fetchImpl
    );

    expect(result.channelUserId).toBe(
      "0c514e7e-57f1-4373-89e5-4bb83a64a853"
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("resumes the same Bimpe conversation after provider communication settles", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.channel_user_id).toBe(
        "2383efcf-5c2c-4974-a91a-21b918081be3"
      );
      expect(body.message).toContain(
        "communication-ee0c9636-9451-4d0a-8a67-f9de5abfd908"
      );
      expect(body.message).toContain("Get Communication Evidence");
      expect(body.message).toContain("Record Provider Response");
      expect(body.message).toContain("human approval checkpoint");

      return Response.json(
        {
          message: "Success",
          data: { id: "message-2", role: "assistant", message: "Resuming" }
        },
        { status: 201 }
      );
    }) as typeof fetch;

    await resumeBimpeMissionAfterCommunication(
      {
        missionId: "mission-bimpe-2383efcf-5c2c-4974-a91a-21b918081be3",
        communicationId: "communication-ee0c9636-9451-4d0a-8a67-f9de5abfd908",
        communicationStatus: "COMPLETED"
      },
      environment,
      fetchImpl
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

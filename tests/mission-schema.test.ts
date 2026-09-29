import { describe, expect, it } from "vitest";
import { missionSchema } from "../lib/schemas";

describe("missionSchema", () => {
  it("accepts the canonical procurement mission", () => {
    const mission = missionSchema.parse({
      id: "mission-demo",
      type: "PROCUREMENT",
      status: "CREATED",
      rawRequest:
        "I need 20 yards of black Ankara delivered to Yaba tomorrow. My budget is ₦70,000.",
      item: "Black Ankara",
      quantity: 20,
      unit: "yards",
      budget: 70000,
      location: "Yaba",
      deadline: "tomorrow",
      approvalRequired: true,
      createdAt: "2026-09-29T12:00:00.000Z"
    });

    expect(mission.item).toBe("Black Ankara");
    expect(mission.approvalRequired).toBe(true);
  });

  it("rejects a negative budget", () => {
    const result = missionSchema.safeParse({
      id: "mission-invalid",
      type: "PROCUREMENT",
      status: "CREATED",
      rawRequest: "Find fabric",
      item: "Fabric",
      budget: -1,
      approvalRequired: true,
      createdAt: "2026-09-29T12:00:00.000Z"
    });

    expect(result.success).toBe(false);
  });
});

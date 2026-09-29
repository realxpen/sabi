import { describe, expect, it } from "vitest";
import {
  canTransition,
  MissionTransitionError,
  transitionMission
} from "../lib/mission/state-machine";
import type { Mission } from "../lib/schemas";

const mission: Mission = {
  id: "mission-demo",
  type: "PROCUREMENT",
  status: "CREATED",
  rawRequest: "Find black Ankara",
  item: "Black Ankara",
  approvalRequired: true,
  createdAt: "2026-09-29T12:00:00.000Z"
};

describe("mission state machine", () => {
  it("allows the canonical first transition", () => {
    expect(canTransition("CREATED", "UNDERSTANDING")).toBe(true);

    const next = transitionMission(mission, "UNDERSTANDING");
    expect(next.status).toBe("UNDERSTANDING");
  });

  it("blocks arbitrary jumps to approval", () => {
    expect(canTransition("CREATED", "APPROVED")).toBe(false);

    expect(() => transitionMission(mission, "APPROVED")).toThrow(
      MissionTransitionError
    );
  });

  it("keeps terminal states terminal", () => {
    expect(canTransition("COMPLETED", "SEARCHING")).toBe(false);
    expect(canTransition("FAILED", "CREATED")).toBe(false);
  });
});

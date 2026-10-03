import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDemoMissionSnapshot } from "../lib/mission/demo-engine";

const repositoryMocks = vi.hoisted(() => ({
  getMissionSnapshot: vi.fn(),
  saveMissionSnapshot: vi.fn()
}));

vi.mock("../lib/integrations/neon/mission-snapshot-repository", () =>
  repositoryMocks
);

vi.mock("@vercel/functions", () => ({ waitUntil: vi.fn() }));
vi.mock("../lib/mission/bimpe-handoff", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/mission/bimpe-handoff")>()),
  dispatchBimpeMissionStart: vi.fn().mockResolvedValue(undefined)
}));

import { dispatchBimpeMissionStart } from "../lib/mission/bimpe-handoff";

import { POST as createMission } from "../app/api/missions/route";
import { GET as getMission } from "../app/api/missions/[id]/route";
import { POST as approveMission } from "../app/api/missions/[id]/approval/route";

const PERFUME_REQUEST =
  "I need 12 bottles of 50ml long-lasting unisex perfume delivered to Yaba tomorrow. My budget is ₦120,000.";

describe("persisted mission API lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("BIMPEAI_API_KEY", "");
    vi.stubEnv("BIMPEAI_AGENT_ID", "");
    vi.mocked(dispatchBimpeMissionStart).mockClear();
    repositoryMocks.getMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockReset();
    repositoryMocks.saveMissionSnapshot.mockImplementation(async (snapshot) => snapshot);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("creates and persists a mission before returning 201", async () => {
    const response = await createMission(
      new Request("http://sabi.test/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: PERFUME_REQUEST, mode: "SIMULATION" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.persisted).toBe(true);
    expect(body.mission.id).toMatch(/^mission-/);
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects an unconfigured live start before creating a mission or contacting anyone", async () => {
    const response = await createMission(
      new Request("http://sabi.test/api/missions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ request: PERFUME_REQUEST, mode: "LIVE" })
      })
    );
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.error).toBe("LIVE_AGENT_NOT_CONFIGURED");
    expect(repositoryMocks.saveMissionSnapshot).not.toHaveBeenCalled();
    expect(dispatchBimpeMissionStart).not.toHaveBeenCalled();
  });

  it("persists a visible handoff before dispatching a configured live mission", async () => {
    vi.stubEnv("BIMPEAI_API_KEY", "test-key");
    vi.stubEnv("BIMPEAI_AGENT_ID", "test-agent");
    const response = await createMission(new Request("http://sabi.test/api/missions", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ request: PERFUME_REQUEST, mode: "LIVE" })
    }));
    const body = await response.json();
    expect(response.status).toBe(201);
    expect(body.agentHandoff.scheduled).toBe(true);
    expect(body.steps).toEqual([expect.objectContaining({ type: "BIMPE_HANDOFF", status: "RUNNING" })]);
    expect(dispatchBimpeMissionStart).toHaveBeenCalledWith(expect.objectContaining({
      mission: expect.objectContaining({ id: body.mission.id }),
      steps: body.steps, communications: []
    }));
  });

  it("reads a persisted mission by id", async () => {
    const snapshot = buildDemoMissionSnapshot("Find perfume", "mission-read");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const response = await getMission(
      new Request("http://sabi.test/api/missions/mission-read"),
      { params: { id: "mission-read" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.mission.id).toBe("mission-read");
    expect(body.persisted).toBe(true);
  });

  it("persists the APPROVED mission status without performing a transaction", async () => {
    const snapshot = buildDemoMissionSnapshot(PERFUME_REQUEST, "mission-approve");
    repositoryMocks.getMissionSnapshot.mockResolvedValue(snapshot);

    const recommendation = snapshot.recommendation;
    expect(recommendation).toBeDefined();

    const response = await approveMission(
      new Request("http://sabi.test/api/missions/mission-approve/approval", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          providerId: recommendation!.providerId,
          quoteId: recommendation!.quoteId
        })
      }),
      { params: { id: "mission-approve" } }
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.missionStatus).toBe("APPROVED");
    expect(body.persisted).toBe(true);
    expect(body.transactionPerformed).toBe(false);
    expect(repositoryMocks.saveMissionSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        mission: expect.objectContaining({ status: "APPROVED" })
      })
    );
  });
});

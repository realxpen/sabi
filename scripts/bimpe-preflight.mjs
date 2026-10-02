const baseUrl = (
  process.env.BIMPEAI_BASE_URL || "https://api.bimpe.ai/api/v1/console"
).replace(/\/$/, "");

const apiKey = process.env.BIMPEAI_API_KEY?.trim();
const agentId = process.env.BIMPEAI_AGENT_ID?.trim();
const workflowId = process.env.BIMPEAI_WORKFLOW_ID?.trim();
const mode = process.env.SABI_COMMUNICATION_MODE?.trim() || "mock";
const testCallsEnabled =
  process.env.BIMPEAI_TEST_CALLS?.trim().toLowerCase() !== "false";

function line(ok, label, detail = "") {
  const prefix = ok ? "✓" : "✗";
  console.log(`${prefix} ${label}${detail ? ` — ${detail}` : ""}`);
}

function parseJson(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return { ok: false, value: fallback, reason: "missing" };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, value: fallback, reason: "invalid JSON" };
  }
}

console.log("SABI × BimpeAI local no-call preflight");
console.log("----------------------------------------");

let ready = true;

const modeReady = mode === "bimpe";
line(modeReady, "SABI communication mode", mode);
ready &&= modeReady;

let baseReady = false;
try {
  const url = new URL(baseUrl);
  baseReady = url.protocol === "https:";
} catch {
  baseReady = false;
}
line(baseReady, "Bimpe Console API base", baseReady ? baseUrl : "invalid HTTPS URL");
ready &&= baseReady;

const apiKeyReady = Boolean(apiKey?.startsWith("sk_"));
line(apiKeyReady, "Bimpe API key", apiKeyReady ? "configured" : "missing or unexpected key shape");
ready &&= apiKeyReady;

line(Boolean(agentId), "Bimpe agent ID", agentId ? "configured" : "missing");
ready &&= Boolean(agentId);

line(Boolean(workflowId), "Bimpe workflow ID", workflowId ? "configured" : "missing");
ready &&= Boolean(workflowId);

line(testCallsEnabled, "Safe test-call mode", testCallsEnabled ? "enabled" : "disabled");
ready &&= testCallsEnabled;

const providersResult = parseJson("SABI_LIVE_TEST_PROVIDERS_JSON", []);
const providers = Array.isArray(providersResult.value) ? providersResult.value : [];
const providerIds = providers
  .filter((provider) => provider && typeof provider === "object")
  .map((provider) => provider.id)
  .filter((id) => typeof id === "string" && id.length > 0);
const providersReady = providersResult.ok && providerIds.length > 0;
line(
  providersReady,
  "Live test provider metadata",
  providersReady
    ? `${providerIds.length} provider${providerIds.length === 1 ? "" : "s"}`
    : providersResult.reason || "must be a non-empty JSON array"
);
ready &&= providersReady;

const consentResult = parseJson("SABI_CONSENTED_PROVIDER_PHONES_JSON", {});
const consentMap =
  consentResult.value &&
  typeof consentResult.value === "object" &&
  !Array.isArray(consentResult.value)
    ? consentResult.value
    : {};
const e164 = /^\+[1-9]\d{6,14}$/;
const consentedIds = Object.entries(consentMap)
  .filter(([, phone]) => typeof phone === "string" && e164.test(phone))
  .map(([id]) => id);
const matchedIds = providerIds.filter((id) => consentedIds.includes(id));
const consentReady = consentResult.ok && matchedIds.length > 0;
line(
  consentReady,
  "Provider ↔ consent mapping",
  consentReady
    ? `${matchedIds.length} matching consent record${matchedIds.length === 1 ? "" : "s"}`
    : "no valid E.164 consent record matches a configured provider ID"
);
ready &&= consentReady;

let remoteReady = false;
if (baseReady && apiKeyReady && agentId) {
  console.log("\nRead-only Bimpe API check");
  try {
    const response = await fetch(`${baseUrl}/agents?limit=100`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "X-Request-Id": "sabi-local-bimpe-preflight"
      }
    });

    if (response.ok) {
      const body = await response.json().catch(() => null);
      const agents = Array.isArray(body?.data) ? body.data : [];
      const agent = agents.find((candidate) => candidate?.id === agentId);
      line(true, "Bimpe API credential", "accepted");
      line(Boolean(agent), "Configured agent visible", agent?.name || (agent ? "yes" : "no"));

      const workflowMatch =
        workflowId && agent?.workflow_id
          ? agent.workflow_id === workflowId
          : null;
      if (workflowMatch !== null) {
        line(workflowMatch, "Agent workflow match");
      } else {
        console.log("• Agent workflow match — not exposed by this list response; verify in the Bimpe dashboard");
      }

      remoteReady = Boolean(agent) && workflowMatch !== false;
    } else if (response.status === 401) {
      line(false, "Bimpe API credential", "rejected (HTTP 401)");
    } else if (response.status === 403) {
      line(false, "Bimpe agent-list permission", "key accepted but scope may be insufficient (HTTP 403)");
    } else if (response.status === 429) {
      line(false, "Bimpe API check", "rate limited (HTTP 429); retry later without placing a call");
    } else {
      line(false, "Bimpe API check", `HTTP ${response.status}`);
    }
  } catch (error) {
    line(false, "Bimpe API reachability", error instanceof Error ? error.message : "request failed");
  }
} else {
  console.log("\n• Read-only Bimpe API check skipped until API key + agent ID + HTTPS base are configured.");
}

ready &&= remoteReady;

console.log("\nVerdict");
if (ready) {
  console.log("✓ READY FOR A CONSENT-GATED BIMPE TEST CALL");
  console.log("The real call still requires an explicit action in SABI Mission Control.");
} else {
  console.log("✗ NOT CALL-READY YET");
  console.log("Fix the failed checks above. No phone call was placed by this command.");
}

console.log("\nSafety: this command prints no API key, operator token, agent-tool token, or phone number.");
process.exitCode = ready ? 0 : 1;

import { randomBytes } from "node:crypto";

function token(prefix) {
  return `${prefix}_${randomBytes(32).toString("base64url")}`;
}

console.log("# SABI Hack Night Preview secrets");
console.log("# Generated locally. Do not commit these values.");
console.log(`SABI_OPERATOR_TOKEN=${token("sabi_operator")}`);
console.log(`SABI_AGENT_TOOL_TOKEN=${token("sabi_agent")}`);

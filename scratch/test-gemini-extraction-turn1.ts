import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { extractRequirementMemory } = await import("../lib/onboarding/extractRequirementMemory");

  const msg = `We are a mortgage company using Encompass, HubSpot, and several vendor systems.
Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.
As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`;

  console.log("Extracting Turn 1...");
  const res = await extractRequirementMemory(msg);
  console.log("Result:", JSON.stringify(res, null, 2));
}

run().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { extractRequirementMemory } = await import("../lib/onboarding/extractRequirementMemory");

  const msg = `Our main goals are to increase loan capacity without increasing headcount, reduce duplicate data entry, improve visibility across teams, improve borrower communication, reduce manual vendor follow-ups, and reduce operational errors.
We process around 700 loans per month and expect volume to keep growing.`;

  console.log("Extracting...");
  const res = await extractRequirementMemory(msg);
  console.log("Result:", JSON.stringify(res, null, 2));
}

run().catch(console.error);

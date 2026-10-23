import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testExtractionDetails() {
  const { extractRequirementMemory } = await import("../lib/onboarding/extractRequirementMemory");

  const userMessage = "I manage operations for a mortgage lending company, and we're experiencing increasing operational inefficiencies as our loan volume grows. Our team spends a significant amount of time manually updating loan statuses, responding to borrower inquiries, and entering the same information across multiple systems. We currently use Encompass LOS as our primary platform, along with HubSpot CRM and several third-party vendor systems. We're not sure whether the right solution is workflow automation, integrations, process improvements, custom development, or something else entirely. Before discussing solutions, I'd like to understand how you would evaluate the situation, identify the root cause of the problem, and determine what would provide the greatest business impact.";

  console.log("Extracting memory...");
  const memory = await extractRequirementMemory(userMessage);

  console.log("=== EXTRACTED MEMORY ===");
  console.log(JSON.stringify(memory, null, 2));
}

testExtractionDetails().catch(console.error);

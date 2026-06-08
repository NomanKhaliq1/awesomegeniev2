import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const [{ runOnboardingAgent }, { routeMessageFallback }] = await Promise.all([
    import("@/lib/agents/onboardingAgent"),
    import("@/lib/agents/routerAgent")
  ]);
  const message =
    "Company is ABC Mortgage. We need Encompass automation for loan status sync within 6 weeks. Email john@abcmortgage.com. Budget $25k-$40k.";

  const routeDecision = routeMessageFallback(message);
  const result = await runOnboardingAgent({}, message, { useSlm: false });

  assert(routeDecision.intent === "knowledge", "Expected knowledge route for Encompass message.");
  assert(result.extractedMemory.service_type === "Mortgage Automation", "Expected Mortgage Automation service.");
  assert(result.extractedMemory.email === "john@abcmortgage.com", "Expected email extraction.");
  assert(result.extractedMemory.company_name === "ABC Mortgage", "Expected company extraction.");
  assert(result.extractedMemory.timeline === "6 weeks", "Expected timeline extraction.");
  assert(result.extractedMemory.budget_range === "$25k-$40k", "Expected budget extraction.");
  assert(result.completionScore > 0, "Expected positive completion score.");
  assert(result.missingFields.includes("Contact person"), "Expected contact person still missing.");
  assert(Boolean(result.nextQuestion), "Expected next question.");

  console.log("Onboarding smoke test passed");
  console.log(`Route: ${routeDecision.intent}`);
  console.log(`Completion score: ${result.completionScore}`);
  console.log(`Missing fields: ${result.missingFields.join(", ")}`);
  console.log(`Next question: ${result.nextQuestion}`);
}

void main();

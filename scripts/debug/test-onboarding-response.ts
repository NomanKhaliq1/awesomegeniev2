import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { composeOnboardingResponse } = await import("@/lib/agents/responseComposer");
  const { routeMessage } = await import("@/lib/agents/routerAgent");
  
  const question = "I just uploaded our requirements document. Tell me, what is the tech support email and project budget listed in it?";
  const routeDecision = await routeMessage(question);

  console.log(`Route Decision: ${JSON.stringify(routeDecision, null, 2)}`);

  const response = await composeOnboardingResponse({
    routeDecision,
    completionScore: 44,
    missingFields: ["Project overview", "Business problem"],
    nextQuestion: "Can you tell me more about your Encompass integration requirements?",
    userMessage: question,
    collectedMemory: {
      company_name: "Apex Mortgage",
      contact_name: "Alex",
      email: "alex@apexmortgage.com",
      service_type: "Mortgage Automation"
    }
  });

  console.log("Onboarding Response Output:");
  console.log(response);
}

main().catch(console.error);

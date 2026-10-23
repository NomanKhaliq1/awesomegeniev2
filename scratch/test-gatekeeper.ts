import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testUpdatedGatekeeper() {
  const { runGatekeeperAgent } = await import("../lib/agents/gatekeeperAgent");

  const userMessage = "I manage operations for a mortgage lending company, and we're experiencing increasing operational inefficiencies as low volume grows. Our team spends a significant amount of time manually updating loan statuses, responding to borrower inquiries, and entering the same information across multiple systems. We currently use Encompass LOS as our primary platform, along with HubSpot CRM and several third-party vendor systems. We're not sure whether the right solution is workflow automation, integrations, process improvements, custom development, or something else entirely. Before discussing solutions, I'd like to understand how you would evaluate the situation, identify the root cause of the problem, and determine what would provide the greatest business impact.";

  const draftResponse = "Aapke mortgage lending company mein operational inefficiencies kee wajah se loan volume kee badhti hui hai. Aapke team ko bahut samay lagta hai loan status ko manual update karna, borrower ke inquiry ko respond karna, aur ek hi information ko multiple systems mein enter karna.\n\nAap Encompass LOS, HubSpot CRM, aur third-party vendor systems ka upyog karte hain. Aapko nahin pata hai ki workflow automation, integrations, process improvements, custom development, ya kuch aur solution ka upyog karna chahiye.\n\nKya aapko pata hai ki aapke team ke kya goals hain? Aapke team ke kya challenges hain? Aapke team ke kya goals hain jo aapke business impact ko badhane ke liye hain?\n\nWhat are the primary business goals or outcomes you want to achieve with this website improvement?";

  console.log("Invoking updated gatekeeper agent...");
  const result = await runGatekeeperAgent(draftResponse, userMessage, 40);

  console.log("=== GATEKEEPER RESULT ===");
  console.log(JSON.stringify(result, null, 2));
}

testUpdatedGatekeeper().catch(console.error);

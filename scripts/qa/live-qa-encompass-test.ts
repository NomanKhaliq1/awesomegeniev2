import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");
  const { getRequirementMemory } = await import("@/lib/data/requirementsRepository");
  const { calculateConfidenceScore, getConfidenceLevel } = await import("@/lib/onboarding/discovery");
  const { calculateReadinessScore } = await import("@/lib/onboarding/fields");

  console.log("==================================================");
  console.log("🚀 STARTING MORTGAGE/ENCOMPASS CONSULTANT QA TEST");
  console.log("==================================================");

  // Start Session
  const session = await startSession();
  const sessionId = session.id;
  console.log(`Session Created! ID: ${sessionId}`);
  console.log(`Initial greeting: "${session.openingMessage}"`);
  console.log(`--------------------------------------------------`);

  // Helper to send message and log metrics
  async function sendMessage(userText: string) {
    console.log(`👤 User: "${userText}"`);
    const response = await handleMessage(sessionId, userText);
    
    // Retrieve memory to check metrics
    const memory = await getRequirementMemory(sessionId);
    const score = calculateConfidenceScore(memory);
    const level = getConfidenceLevel(score);
    const readiness = calculateReadinessScore(memory);

    console.log(`🤖 Bot:\n${response.message}`);
    console.log(`--------------------------------------------------`);
    console.log(`📈 Completion Score: ${response.completionScore}%`);
    console.log(`🛡️ Weighted Confidence: ${score}% (${level})`);
    console.log(`📋 Readiness Score: ${readiness}%`);
    console.log(`⚠️ Missing Fields: [${response.missingFields.slice(0, 5).join(", ")}...]`);
    console.log(`🏷️ Onboarding State: ${response.status}`);
    console.log(`==================================================`);
    
    // Wait 25 seconds to avoid Groq rate limits
    await new Promise((resolve) => setTimeout(resolve, 25000));
    return response;
  }

  // Turn 1: User introduces mortgage operational inefficiencies (Low Confidence)
  await sendMessage(
    "Hi, I manage operations for a mortgage lending company. Our primary platform is Encompass LOS. We are experiencing increasing operational inefficiencies. Our team spends a significant amount of time manually updating loan statuses and entering information across multiple systems."
  );

  // Turn 2: User answers business goals & objectives (Increasing Confidence)
  await sendMessage(
    "Our primary goals are to reduce manual work performed by our operations team, improve response times for borrowers, and enable our staff to handle a higher loan volume without significantly increasing headcount. We also want to reduce data entry errors."
  );

  // Turn 3: User provides support metrics (Medium/Strong Understanding)
  // Should trigger Strong Understanding (60-80%). Should print Discovery Summary, Root Cause Analysis, Key Insights, and compare multiple options (redesign, portal, chatbot, integrations).
  await sendMessage(
    "On average, our team handles between 80 and 120 borrower-related inquiries per day. The support workload takes up about 60% of our team's daily hours."
  );

  // Turn 4: User shares existing systems (High Confidence)
  // Should trigger High Confidence (>80%). Should print Discovery Summary, Root Cause, Key Insights, and a fully justified executive recommendation.
  await sendMessage(
    "We currently use HubSpot CRM and Notion for our internal knowledge base. We are looking to integrate this solution directly with HubSpot CRM to capture leads automatically. Our budget is around $15,000."
  );

  // Turn 5: User shares contact details (Admin/Logistics)
  await sendMessage(
    "My name is Noman Khaliq. You can reach me at noman@example.com."
  );

  console.log("✅ MORTGAGE/ENCOMPASS CONSULTANT QA TEST COMPLETED!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Mortgage consultant test failed:", error);
  process.exit(1);
});

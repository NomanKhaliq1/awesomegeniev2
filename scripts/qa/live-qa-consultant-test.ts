import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");
  const { getRequirementMemory } = await import("@/lib/data/requirementsRepository");
  const { calculateConfidenceScore, getConfidenceLevel } = await import("@/lib/onboarding/discovery");

  console.log("==================================================");
  console.log("🚀 STARTING ENTERPRISE CONSULTANT DISCOVERY QA TEST");
  console.log("==================================================");

  // Start Session
  const session = await startSession();
  const sessionId = session.id;
  console.log(`Session Created! ID: ${sessionId}`);
  console.log(`Initial greeting: "${session.openingMessage}"`);
  console.log(`--------------------------------------------------`);

  // Helper to send message and log discovery metrics
  async function sendMessage(userText: string) {
    console.log(`👤 User: "${userText}"`);
    const response = await handleMessage(sessionId, userText);
    
    // Retrieve memory to check extracted discovery fields
    const memory = await getRequirementMemory(sessionId);
    const score = calculateConfidenceScore(memory);
    const level = getConfidenceLevel(score);

    console.log(`🤖 Bot:\n${response.message}`);
    console.log(`--------------------------------------------------`);
    console.log(`📈 Completion Score: ${response.completionScore}%`);
    console.log(`🛡️ Weighted Confidence: ${score}% (${level})`);
    console.log(`⚠️ Missing Fields: [${response.missingFields.slice(0, 5).join(", ")}...]`);
    console.log(`🏷️ Onboarding State: ${response.status}`);
    console.log(`==================================================`);
    
    // Wait 25 seconds to avoid Groq rate limits
    await new Promise((resolve) => setTimeout(resolve, 25000));
    return response;
  }

  // Turn 1: User introduces problem but lacks metrics (Low Confidence)
  // Should NOT recommend anything. Should ask high-value discovery question.
  await sendMessage(
    "Hi, I own a custom software development company. Our website works, but visitors say it is difficult to find information. We get a lot of repetitive inquiries and want to make it easier for them to get info."
  );

  // Turn 2: User answers business goals & pain points (Increasing Confidence)
  await sendMessage(
    "Our primary business goal is to free up our support team from answering basic questions and improve lead conversion. The main pain point is that clients keep asking about our web development pricing, AI solutions availability, and how to request a quote, which takes hours of manual email replies."
  );

  // Turn 3: User provides traffic & inquiry volume metrics (Medium Confidence)
  // Should trigger Medium Confidence (>=40%). Should print Business Summary and compare multiple options (redesign, portal, chatbot).
  await sendMessage(
    "We receive about 5,000 website visitors per month, and our team handles around 40 support/inquiry emails daily. The support workload takes up about 60% of our team's daily hours."
  );

  // Turn 4: User shares existing systems (High Confidence)
  // Should trigger High Confidence (>75%). Should print Business Summary and show a fully justified recommendation.
  await sendMessage(
    "We currently use HubSpot CRM and Notion for our internal knowledge base. We are looking to integrate this solution directly with HubSpot CRM to capture leads automatically. Our budget is around $15,000."
  );

  // Turn 5: User shares contact details (Admin/Logistics)
  await sendMessage(
    "My name is Noman Khaliq. You can reach me at noman@example.com."
  );

  console.log("✅ ENTERPRISE CONSULTANT DISCOVERY QA TEST COMPLETED!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Consultant discovery test failed:", error);
  process.exit(1);
});

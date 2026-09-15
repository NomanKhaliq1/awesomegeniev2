import { loadEnvConfig } from "@next/env";
import crypto from "crypto";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");
  const { completeOnboarding } = await import("@/lib/chat/completeOnboarding");

  console.log("==================================================");
  console.log("🚀 STARTING CONVERSATIONAL CONSULTING & DISCOVERY QA TEST");
  console.log("==================================================");

  // Start Session
  const session = await startSession();
  const sessionId = session.id;
  console.log(`\n[STEP 1] Session Created! ID: ${sessionId}`);
  console.log(`Initial Bot Greeting: \n"${session.openingMessage}"`);
  console.log(`--------------------------------------------------`);

  const chatTranscript: Array<{ role: string; content: string }> = [
    { role: "assistant", content: session.openingMessage }
  ];

  // Helper to send message and log
  async function sendMessage(userText: string) {
    console.log(`\n👤 User (Sarah): "${userText}"`);
    chatTranscript.push({ role: "user", content: userText });
    
    const response = await handleMessage(sessionId, userText);
    console.log(`🤖 Bot (Awesome Genie): "${response.message}"`);
    console.log(`📈 Progress Score: ${response.completionScore}%`);
    console.log(`⚠️ Missing Fields: [${response.missingFields.join(", ")}]`);
    console.log(`✅ Collected Fields: [${response.collectedFields.join(", ")}]`);
    console.log(`🏷️ Onboarding State: ${response.status} (${response.statusLabel})`);
    console.log(`--------------------------------------------------`);
    
    chatTranscript.push({ role: "assistant", content: response.message });
    return response;
  }

  // 1. User presents a raw business problem (no tech details, no service name)
  await sendMessage(
    "Hi, our mortgage customers are complaining that it takes days to get their loan status updates. Our staff is stressed out because they have to manually search through different screens all day long to find updates. We don't know what tech we need, we just want to fix this delay."
  );

  // 2. User provides contact info, company name, and mentions Encompass in response to bot query
  await sendMessage(
    "We are Choice Lenders. My name is Sarah, you can reach me at sarah@choicelenders.com or 555-9088. We use a software called Encompass to manage loans, but we don't know if it has api or whatever."
  );

  // 3. User describes where the sales data goes (Salesforce) and what manual steps are done
  await sendMessage(
    "Our sales agents use Salesforce. Today, the admin team has to check Encompass for status changes, write them on paper, and then manually type them into Salesforce for the loan officers."
  );

  // 4. User provides timeline and budget constraints when prompted
  await sendMessage(
    "We want to launch this as soon as possible, ideally within 2 months. We can spend about $25,000 on this project."
  );

  // 5. User requests to wrap up and finalize the requirements
  await sendMessage(
    "Yes, that is all the info I have. Please go ahead and submit this project request."
  );

  // 6. Complete Onboarding and run Google Drive pipeline
  console.log(`\n[STEP 6] Simulating Onboarding Completion...`);
  const completionResult = await completeOnboarding(sessionId);
  console.log(`🎉 Completion Call Successful!`);
  console.log(`📜 Brief Title: "${completionResult.brief.title}"`);
  console.log(`📂 Google Drive Status: ${completionResult.drive.status}`);
  if (completionResult.drive.status === "uploaded") {
    console.log(`🔗 Web View Link: ${completionResult.drive.webViewLink}`);
  }
  console.log(`==================================================`);
  console.log("✅ CONSULTING & DISCOVERY QA TEST COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Consulting QA Simulation failed with error:", error);
  process.exit(1);
});

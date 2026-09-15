import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");
  const { completeOnboarding } = await import("@/lib/chat/completeOnboarding");

  console.log("==================================================");
  console.log("🚀 STARTING NON-TECHNICAL RAW CLIENT DISCOVERY QA TEST");
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
    console.log(`\n👤 User (Noman): "${userText}"`);
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

  // 1. User presents a raw non-technical business problem
  await sendMessage(
    "Hi, I run a grocery store and our customers complain that their deliveries are always late. I want to build some kind of delivery application or website to track deliveries, but I have no technical knowledge. Please tell me what tech we need and what we should do."
  );

  // 2. User provides contact info, company name, in response to bot query
  await sendMessage(
    "Okay, that makes sense. The store name is 'Green Grocers'. I am Noman Khaliq. You can reach me at noman@greengrocers.com or phone 555-0199."
  );

  // 3. User describes features and asks about timeline
  await sendMessage(
    "We want customers to order online, track the delivery rider's live location, and get status updates. For the timeline, can we build this within 3 months?"
  );

  // 4. User provides budget constraints when prompted
  await sendMessage(
    "We can spend about $15,000 on this project. Is that a reasonable budget?"
  );

  // 5. User requests to wrap up and submit
  await sendMessage(
    "Yes, this looks good. Please submit the project request so your team can look into it."
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
  console.log("✅ RAW CLIENT DISCOVERY QA TEST COMPLETED SUCCESSFULLY!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Raw Client QA Simulation failed with error:", error);
  process.exit(1);
});

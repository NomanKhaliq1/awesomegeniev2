import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const { startSession } = await import("@/lib/chat/startSession");
  const { handleMessage } = await import("@/lib/chat/handleMessage");

  console.log("==================================================");
  console.log("🚀 STARTING LOOP VERIFICATION QA TEST");
  console.log("==================================================");

  // Start Session
  const session = await startSession();
  const sessionId = session.id;
  console.log(`\nSession Created! ID: ${sessionId}`);
  console.log(`--------------------------------------------------`);

  // Helper to send message and log
  async function sendMessage(userText: string) {
    console.log(`👤 User: "${userText}"`);
    const response = await handleMessage(sessionId, userText);
    console.log(`🤖 Bot: "${response.message.replace(/\n/g, " ")}"`);
    console.log(`🏷️ Intent: ${response.status} | Score: ${response.completionScore}%`);
    console.log(`--------------------------------------------------`);
    
    // Wait 10 seconds after each message to avoid Groq TPM rate limits
    await new Promise((resolve) => setTimeout(resolve, 10000));
    return response;
  }

  // Exact transcript sequence from screenshot
  await sendMessage("tell me about awesome services?");
  await sendMessage("Does awesome technologies design any logo for a mortgage company?");
  await sendMessage("i run a cold drink company fanta");
  await sendMessage("HR");
  await sendMessage("i want to build a website for my fanta company");
  await sendMessage("No HR is good");
  await sendMessage("i want to build a website for my fanta company");
  await sendMessage("No there is no one who will lead only HR will take care");
  await sendMessage("i need a website for my brand focus fanta company premium design");

  console.log("==================================================");
  console.log("✅ LOOP VERIFICATION QA TEST COMPLETED!");
  console.log("==================================================");
}

main().catch((error) => {
  console.error("❌ Loop Verification failed:", error);
  process.exit(1);
});

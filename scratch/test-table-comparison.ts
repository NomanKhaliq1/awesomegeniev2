import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testTableComparison() {
  const { handleMessage } = await import("../lib/chat/handleMessage");
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const { data: session, error } = await supabase
    .from("chat_sessions")
    .insert({
      status: "collecting_core",
      completion_score: 0,
      missing_fields: []
    })
    .select("id")
    .single();

  if (error || !session) {
    console.error("Error creating test session:", error);
    return;
  }

  console.log("Created test session:", session.id);

  const userMessage = "Can you compare your Encompass plugin use cases in a table?";

  console.log(`Sending message: "${userMessage}"`);
  const response = await handleMessage(session.id, userMessage);

  console.log("\n=== INTEGRATION RESPONSE ===");
  console.log(response.message);
  console.log("\n=== METADATA ===");
  console.log("Status:", response.status);
  console.log("Completion Score:", response.completionScore);
}

testTableComparison().catch(console.error);

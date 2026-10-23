import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testProductRouting() {
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

  const userMessage = "Can you tell me about your Encompass plugins and what problems they help solve?";

  console.log("Sending informational message to handleMessage...");
  const response = await handleMessage(session.id, userMessage);

  console.log("=== INTEGRATION RESPONSE ===");
  console.log(response.message);
  console.log("Status:", response.status);
  console.log("Completion Score:", response.completionScore);
  console.log("Collected Fields:", response.collectedFields);
  console.log("Missing Fields:", response.missingFields);
}

testProductRouting().catch(console.error);

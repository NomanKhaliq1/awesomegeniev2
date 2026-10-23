import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testRelevance() {
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
    console.error("Error creating session:", error);
    return;
  }

  const queries = [
    "Can you tell me about Marvel movies?",
    "We need workflow automation for our mortgage processing."
  ];

  for (const query of queries) {
    console.log(`\n=======================`);
    console.log(`Sending query: "${query}"`);
    const response = await handleMessage(session.id, query);
    console.log(`Response message:\n${response.message}`);
    console.log(`Status: ${response.status}`);
    console.log(`Has Discovery Headers: ${response.message.includes("### What I Understand So Far")}`);
  }
}

testRelevance().catch(console.error);

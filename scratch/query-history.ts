import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function queryHistory() {
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  // Get the most recent session
  const { data: sessions, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, status, completion_score, missing_fields, updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (sessionError || !sessions || sessions.length === 0) {
    console.error("Error fetching sessions:", sessionError);
    return;
  }

  const session = sessions[0];
  console.log("=== LATEST SESSION ===");
  console.log(session);

  // Get messages for this session
  const { data: messages, error: messagesError } = await supabase
    .from("chat_messages")
    .select("id, role, content, created_at, metadata")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  if (messagesError) {
    console.error("Error fetching messages:", messagesError);
    return;
  }

  console.log("\n=== CONVERSATION MESSAGES ===");
  messages?.forEach((msg) => {
    console.log(`\n[${msg.created_at}] ${msg.role.toUpperCase()}:`);
    console.log(msg.content);
    if (msg.metadata) {
      console.log("Metadata:", JSON.stringify(msg.metadata, null, 2));
    }
  });
}

queryHistory().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  // Fetch the latest chat session
  const { data: sessions } = await supabase
    .from("chat_sessions")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1);

  if (!sessions || sessions.length === 0) {
    console.log("No sessions found.");
    return;
  }

  const sessionId = sessions[0].id;
  console.log(`Analyzing latest Session ID: ${sessionId}`);

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  console.log("\n=== CHAT MESSAGES ===");
  messages?.forEach((msg) => {
    console.log(`[${msg.role}]: "${msg.content}"`);
    if (msg.metadata) {
      console.log(`Metadata: ${JSON.stringify(msg.metadata, null, 2)}`);
    }
    console.log("---");
  });

  const { data: ragLogs } = await supabase
    .from("rag_retrieval_logs")
    .select("*")
    .eq("session_id", sessionId);

  console.log("\n=== RAG RETRIEVAL LOGS ===");
  console.log(JSON.stringify(ragLogs, null, 2));
}

main().catch(console.error);

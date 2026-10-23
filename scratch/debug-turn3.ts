import { loadEnvConfig } from "@next/env";

async function debug() {
  const { combined } = loadEnvConfig(process.cwd());
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");

  const supabase = createSupabaseServiceClient();
  // Get the latest assistant message from chat_messages
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("content, role")
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(3);

  if (error || !messages) {
    console.error("Error fetching messages:", error);
    return;
  }

  // We want the one from Turn 3, which is the second most recent assistant message (Turn 4 is most recent)
  const turn3Msg = messages[1]?.content || "";
  console.log("--- Turn 3 Message ---");
  console.log(turn3Msg);
  console.log("----------------------");

  const lower3 = turn3Msg.toLowerCase();
  const hasHubspot = lower3.includes("hubspot");
  const hasSync = lower3.includes("synchronization");
  const hasWorkflow = lower3.includes("workflow automation");

  console.log("hasHubspot:", hasHubspot);
  console.log("hasSync:", hasSync);
  console.log("hasWorkflow:", hasWorkflow);
  console.log("Evaluation (no parens):", hasHubspot && hasSync || hasWorkflow);
  console.log("Evaluation (with parens):", hasHubspot && (hasSync || hasWorkflow));
}

debug().catch(console.error);

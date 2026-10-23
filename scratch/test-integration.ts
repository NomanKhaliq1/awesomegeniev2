import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function testHandleMessage() {
  const { handleMessage } = await import("../lib/chat/handleMessage");

  // Create a new session or fetch session ID from db if needed. Let's just create a new mock session ID or run it.
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

  const userMessage = "I manage operations for a mortgage lending company, and we're experiencing increasing operational inefficiencies as our loan volume grows. Our team spends a significant amount of time manually updating loan statuses, responding to borrower inquiries, and entering the same information across multiple systems. We currently use Encompass LOS as our primary platform, along with HubSpot CRM and several third-party vendor systems. We're not sure whether the right solution is workflow automation, integrations, process improvements, custom development, or something else entirely. Before discussing solutions, I'd like to understand how you would evaluate the situation, identify the root cause of the problem, and determine what would provide the greatest business impact.";

  console.log("Sending message to handleMessage...");
  const response = await handleMessage(session.id, userMessage);

  console.log("=== INTEGRATION RESPONSE ===");
  console.log(response.message);
  console.log("Status:", response.status);
  console.log("Completion Score:", response.completionScore);
}

testHandleMessage().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { handleMessage } from "../lib/chat/handleMessage";
import { createSupabaseServiceClient } from "../lib/supabase/server";

async function run() {
  const supabase = createSupabaseServiceClient();
  const { data: session } = await supabase
    .from("chat_sessions")
    .insert({
      status: "collecting_core",
      completion_score: 0,
      missing_fields: []
    })
    .select("id")
    .single();

  if (!session) {
    console.error("Failed to create session");
    return;
  }

  const sessionId = session.id;
  console.log(`Created session: ${sessionId}`);

  const input1 = `We are a mortgage company using Encompass, HubSpot, and several vendor systems.
Our processors spend a lot of time manually updating loan statuses, notifying borrowers, updating HubSpot records, and coordinating with title and appraisal vendors.
As our loan volume grows, this manual work is becoming harder to manage. We want to understand whether automation, integrations, or a custom Encompass plugin would be the best solution.`;

  console.log("Calling handleMessage...");
  const response1 = await handleMessage(sessionId, input1);
  console.log("Response message:", response1.message);
}

run().catch(console.error);

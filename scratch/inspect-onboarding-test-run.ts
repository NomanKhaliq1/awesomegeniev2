import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const { calculateConfidenceScore } = await import("../lib/onboarding/discovery");
  const { calculateReadinessScore, getMissingRequiredFields } = await import("../lib/onboarding/fields");
  const { countKnownCategories } = await import("../lib/agents/responseComposer");

  const supabase = createSupabaseServiceClient();

  const { data: sessions, error } = await supabase
    .from("chat_sessions")
    .select("id, status, completion_score, missing_fields, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error || !sessions || sessions.length === 0) {
    console.error("Failed to find chat session:", error);
    return;
  }

  const session = sessions[0];
  const sessionId = session.id;
  console.log(`Inspecting Chat Session: ${sessionId} (Created: ${session.created_at})`);

  const { data: req } = await supabase
    .from("client_requirements")
    .select("structured_memory")
    .eq("session_id", sessionId)
    .maybeSingle();

  const memory = req?.structured_memory ?? {};
  console.log("Memory in database (structured_memory):", JSON.stringify(memory, null, 2));

  const confidence = calculateConfidenceScore(memory);
  const readiness = calculateReadinessScore(memory);
  const knownCategories = countKnownCategories(memory);
  const missing = await getMissingRequiredFields(memory);

  console.log(`Confidence Score: ${confidence}`);
  console.log(`Readiness Score: ${readiness}`);
  console.log(`Known Categories: ${knownCategories}`);
  console.log("Missing Fields:", missing.map(f => `${f.key} (priority: ${f.priority})`));
}

run().catch(console.error);

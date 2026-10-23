import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function inspectPrompts() {
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("prompt_templates")
    .select("name, template, is_active")
    .in("name", ["chat.generative_response_system", "chat.generative_knowledge_response_system"]);

  if (error) {
    console.error("Error fetching prompts:", error);
    return;
  }

  console.log("=== INSPECT PROMPTS ===");
  data?.forEach((p) => {
    console.log(`\n--- PROMPT: ${p.name} (Active: ${p.is_active}) ---`);
    console.log(p.template);
  });
}

inspectPrompts().catch(console.error);

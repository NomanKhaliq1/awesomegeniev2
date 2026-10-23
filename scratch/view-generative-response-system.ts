import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function run() {
  const { createSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createSupabaseServiceClient();
  const { data } = await supabase
    .from("prompt_templates")
    .select("template")
    .eq("name", "chat.generative_response_system")
    .single();
  
  if (data?.template) {
    const fs = await import("fs");
    fs.writeFileSync("scratch/generative-response-system.txt", data.template);
    console.log("Wrote to scratch/generative-response-system.txt, size:", data.template.length);
  } else {
    console.log("No template found.");
  }
}
run().catch(console.error);

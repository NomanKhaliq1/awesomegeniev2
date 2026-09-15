import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const sessionId = "0e7b4560-70d6-4780-8455-667ecf16d5ee";

  const { data, error } = await supabase
    .from("client_requirements")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Structured Memory:");
  console.log(JSON.stringify(data.structured_memory, null, 2));
}

main().catch(console.error);

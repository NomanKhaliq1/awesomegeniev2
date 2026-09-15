import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const { data, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("key", "core_required_fields")
    .single();

  if (error) {
    console.error("Error fetching core_required_fields:", error.message);
    return;
  }

  console.log("Database core_required_fields value:");
  console.log(JSON.stringify(data.value, null, 2));
}

main().catch(console.error);

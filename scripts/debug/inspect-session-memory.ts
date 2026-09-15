import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const sessionId = "d909e4f5-2cf1-4d2d-88a9-f6eedc112ca7"; // from the last test run
  
  const { data, error } = await supabase
    .from("client_requirements")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    console.error("Error fetching requirement:", error);
    return;
  }

  console.log("Memory:", JSON.stringify(data.structured_memory, null, 2));

  const { data: values, error: valError } = await supabase
    .from("client_requirement_values")
    .select("*")
    .eq("requirement_id", data.id);

  if (valError) {
    console.error("Error fetching values:", valError);
    return;
  }

  console.log("Requirement Values:");
  values.forEach((v) => {
    console.log(`- ${v.field_key}: ${v.value}`);
  });
}

main().catch(console.error);

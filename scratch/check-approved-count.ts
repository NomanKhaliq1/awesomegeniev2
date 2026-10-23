import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createOptionalSupabaseServiceClient } = await import("../lib/supabase/server");
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase client is not configured.");
  }

  const { data, error, count } = await supabase
    .from("website_sections")
    .select("id, website_json_sources!inner(url)", { count: "exact" })
    .eq("website_json_sources.approved_for_rag", true)
    .eq("website_json_sources.needs_review", false);

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("Total approved sections count:", count);
  console.log("First few sections urls:", data.slice(0, 5).map(d => d.website_json_sources));
}

main().catch(console.error);

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

async function main() {
  const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
  const supabase = createSupabaseServiceClient();

  const { data: logs, error } = await supabase
    .from("drive_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Error fetching drive logs:", error.message);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("No drive logs found in Supabase.");
    return;
  }

  console.log("=== LATEST DRIVE LOGS ===");
  logs.forEach((log) => {
    console.log(`[${log.created_at}] Session: ${log.session_id}`);
    console.log(`Action: ${log.action} | Status: ${log.status}`);
    if (log.drive_folder_id) console.log(`Folder ID: ${log.drive_folder_id}`);
    if (log.drive_file_id) console.log(`File ID: ${log.drive_file_id}`);
    if (log.error_message) console.log(`Error: ${log.error_message}`);
    if (log.metadata) console.log(`Metadata: ${JSON.stringify(log.metadata, null, 2)}`);
    console.log("--------------------------------------");
  });
}

main().catch(console.error);

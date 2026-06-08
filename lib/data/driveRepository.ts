import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export async function insertDriveLog(input: {
  sessionId?: string | null;
  action: string;
  status: string;
  driveFolderId?: string | null;
  driveFileId?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("drive_logs")
    .insert({
      session_id: input.sessionId ?? null,
      action: input.action,
      status: input.status,
      drive_folder_id: input.driveFolderId ?? null,
      drive_file_id: input.driveFileId ?? null,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    })
    .select("*")
    .single();

  if (error) {
    console.error("Supabase insertDriveLog failed:", error.message);
    return null;
  }

  return data;
}

export async function updateProjectBriefDriveFileId({
  briefId,
  driveFileId
}: {
  briefId: string;
  driveFileId: string;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("project_briefs")
    .update({
      drive_file_id: driveFileId
    })
    .eq("id", briefId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Supabase updateProjectBriefDriveFileId failed: ${error.message}`);
  }

  return data;
}

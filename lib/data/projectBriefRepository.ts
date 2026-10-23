import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export type ProjectBriefRow = {
  id: string;
  client_id: string | null;
  session_id: string;
  requirement_id: string | null;
  title: string;
  content_markdown: string;
  content_json: Record<string, unknown>;
  drive_file_id: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertProjectBrief(input: {
  sessionId: string;
  requirementId?: string | null;
  title: string;
  contentMarkdown: string;
  contentJson?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const { data: existing, error: existingError } = await supabase
    .from("project_briefs")
    .select("id")
    .eq("session_id", input.sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existingError) {
    throw new Error(`Supabase read project_briefs failed: ${existingError.message}`);
  }

  const payload = {
    session_id: input.sessionId,
    requirement_id: input.requirementId ?? null,
    title: input.title,
    content_markdown: input.contentMarkdown,
    content_json: input.contentJson ?? {}
  };

  const query = existing
    ? supabase.from("project_briefs").update(payload).eq("id", existing.id)
    : supabase.from("project_briefs").insert(payload);

  const { data, error } = await query.select("*").single<ProjectBriefRow>();

  if (error) {
    throw new Error(`Supabase upsertProjectBrief failed: ${error.message}`);
  }

  return data;
}

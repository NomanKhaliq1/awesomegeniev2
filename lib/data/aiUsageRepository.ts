import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export async function logAiUsage(input: {
  provider?: string | null;
  model?: string | null;
  task: string;
  promptTokens?: number | null;
  completionTokens?: number | null;
  totalTokens?: number | null;
  status?: "success" | "failed";
  errorMessage?: string | null;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("ai_usage_logs").insert({
    provider: input.provider ?? null,
    model: input.model ?? null,
    task: input.task,
    prompt_tokens: input.promptTokens ?? null,
    completion_tokens: input.completionTokens ?? null,
    total_tokens: input.totalTokens ?? null,
    status: input.status ?? "success",
    error_message: input.errorMessage ?? null
  });

  if (error) {
    console.error("Supabase logAiUsage failed:", error.message);
  }
}

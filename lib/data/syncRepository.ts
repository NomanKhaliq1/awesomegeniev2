import { createOptionalSupabaseServiceClient } from "@/lib/supabase/server";

export async function createSyncJob(input: {
  jobType: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("sync_jobs")
    .insert({
      job_type: input.jobType,
      status: "running",
      started_at: new Date().toISOString(),
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(`Supabase createSyncJob failed: ${error.message}`);
  }

  return data;
}

export async function completeSyncJob(input: {
  jobId: string;
  status: "completed" | "failed";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("sync_jobs")
    .update({
      status: input.status,
      completed_at: new Date().toISOString(),
      error_message: input.errorMessage ?? null,
      ...(input.metadata ? { metadata: input.metadata } : {})
    })
    .eq("id", input.jobId);

  if (error) {
    throw new Error(`Supabase completeSyncJob failed: ${error.message}`);
  }
}

export async function createSyncJobItem(input: {
  syncJobId: string;
  url: string;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("sync_job_items")
    .insert({
      sync_job_id: input.syncJobId,
      url: input.url,
      status: "running",
      metadata: input.metadata ?? {}
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(`Supabase createSyncJobItem failed: ${error.message}`);
  }

  return data;
}

export async function completeSyncJobItem(input: {
  itemId: string;
  status: "completed" | "failed" | "skipped";
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("sync_job_items")
    .update({
      status: input.status,
      error_message: input.errorMessage ?? null,
      metadata: input.metadata ?? {}
    })
    .eq("id", input.itemId);

  if (error) {
    throw new Error(`Supabase completeSyncJobItem failed: ${error.message}`);
  }
}

export async function insertWebhookEvent(input: {
  source: string;
  eventType: string;
  payload?: Record<string, unknown>;
  status?: string;
}) {
  const supabase = createOptionalSupabaseServiceClient();

  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("webhook_events")
    .insert({
      source: input.source,
      event_type: input.eventType,
      payload: input.payload ?? {},
      status: input.status ?? "received"
    })
    .select("id")
    .single<{ id: string }>();

  if (error) {
    throw new Error(`Supabase insertWebhookEvent failed: ${error.message}`);
  }

  return data;
}

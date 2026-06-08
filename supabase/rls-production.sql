-- Production RLS baseline.
-- The current app reads/writes these tables from server-side API routes using
-- the Supabase service role key. Service role bypasses RLS.
-- Do not run this if you later add direct client-side Supabase access without
-- adding explicit user/session policies for that access pattern.

alter table if exists public.clients enable row level security;
alter table if exists public.chat_sessions enable row level security;
alter table if exists public.chat_messages enable row level security;
alter table if exists public.conversation_summaries enable row level security;
alter table if exists public.service_categories enable row level security;
alter table if exists public.onboarding_fields enable row level security;
alter table if exists public.client_requirements enable row level security;
alter table if exists public.client_requirement_values enable row level security;
alter table if exists public.uploaded_files enable row level security;
alter table if exists public.project_briefs enable row level security;
alter table if exists public.drive_logs enable row level security;
alter table if exists public.ai_usage_logs enable row level security;
alter table if exists public.rag_retrieval_logs enable row level security;
alter table if exists public.prompt_templates enable row level security;
alter table if exists public.model_settings enable row level security;
alter table if exists public.system_settings enable row level security;
alter table if exists public.website_json_sources enable row level security;
alter table if exists public.website_sections enable row level security;
alter table if exists public.website_assets enable row level security;
alter table if exists public.website_buttons enable row level security;
alter table if exists public.website_forms enable row level security;
alter table if exists public.rag_chunks enable row level security;
alter table if exists public.document_sources enable row level security;
alter table if exists public.document_chunks enable row level security;
alter table if exists public.sync_jobs enable row level security;
alter table if exists public.sync_job_items enable row level security;
alter table if exists public.webhook_events enable row level security;

-- Optional public read policies can be added later for non-sensitive lookup
-- tables only if the frontend starts reading Supabase directly.

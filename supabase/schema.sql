create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_name text,
  contact_name text,
  email text,
  phone text,
  website_url text,
  country_location text,
  industry text,
  decision_maker_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'active',
  completion_score integer not null default 0 check (completion_score >= 0 and completion_score <= 100),
  missing_fields text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  summary text not null,
  message_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_fields (
  id uuid primary key default gen_random_uuid(),
  service_category_id uuid references public.service_categories(id) on delete cascade,
  field_key text not null,
  label text not null,
  question text not null,
  field_type text not null default 'text',
  is_required boolean not null default true,
  sort_order integer not null default 0,
  help_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_category_id, field_key)
);

create table if not exists public.client_requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  service_category_id uuid references public.service_categories(id) on delete set null,
  project_overview text,
  business_problem text,
  current_process text,
  pain_points text,
  required_features text,
  success_outcome text,
  timeline text,
  budget_range text,
  priority_level text,
  existing_tools text,
  integration_requirements text,
  content_assets_status text,
  structured_memory jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id)
);

create table if not exists public.client_requirement_values (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.client_requirements(id) on delete cascade,
  field_id uuid references public.onboarding_fields(id) on delete set null,
  field_key text not null,
  value text,
  value_json jsonb,
  source_message_id uuid references public.chat_messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (requirement_id, field_key)
);

create table if not exists public.uploaded_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  storage_bucket text not null,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  file_kind text not null default 'asset',
  extracted_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.project_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  requirement_id uuid references public.client_requirements(id) on delete set null,
  title text not null default 'Project Brief',
  content_markdown text not null,
  content_json jsonb not null default '{}'::jsonb,
  drive_file_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.drive_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid references public.chat_sessions(id) on delete cascade,
  action text not null,
  status text not null,
  drive_folder_id text,
  drive_file_id text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_usage_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete cascade,
  provider text,
  model text,
  task text not null,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  cost_estimate numeric(12, 6),
  status text not null default 'success',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_retrieval_logs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.chat_sessions(id) on delete cascade,
  namespace text not null,
  query text not null,
  match_count integer not null default 0,
  matches jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.prompt_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  template text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.model_settings (
  id uuid primary key default gen_random_uuid(),
  task text not null unique,
  provider text not null,
  model text not null,
  temperature numeric(3, 2) not null default 0.2,
  max_tokens integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.system_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.website_json_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text,
  content_hash text,
  lastmod timestamptz,
  approved_for_rag boolean not null default false,
  needs_review boolean not null default true,
  pinecone_synced boolean not null default false,
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_sections (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.website_json_sources(id) on delete cascade,
  heading text,
  content text not null,
  sort_order integer not null default 0,
  content_hash text,
  pinecone_synced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.website_assets (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.website_json_sources(id) on delete cascade,
  url text not null,
  asset_type text,
  alt_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.website_buttons (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.website_json_sources(id) on delete cascade,
  label text,
  href text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.website_forms (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.website_json_sources(id) on delete cascade,
  form_name text,
  action_url text,
  fields jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.rag_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('website', 'uploaded_file')),
  source_id uuid not null,
  section_id uuid,
  chunk_index integer not null,
  pinecone_vector_id text not null unique,
  pinecone_namespace text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_sources (
  id uuid primary key default gen_random_uuid(),
  uploaded_file_id uuid not null references public.uploaded_files(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  title text,
  extracted_text text not null,
  content_hash text,
  pinecone_namespace text not null,
  pinecone_synced boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_source_id uuid not null references public.document_sources(id) on delete cascade,
  chunk_index integer not null,
  pinecone_vector_id text not null unique,
  pinecone_namespace text not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_source_id, chunk_index)
);

create table if not exists public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'queued',
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sync_job_items (
  id uuid primary key default gen_random_uuid(),
  sync_job_id uuid not null references public.sync_jobs(id) on delete cascade,
  url text,
  status text not null default 'queued',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  status text not null default 'received',
  error_message text,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_created on public.chat_messages(session_id, created_at);
create index if not exists idx_onboarding_fields_service_sort on public.onboarding_fields(service_category_id, sort_order);
create index if not exists idx_uploaded_files_session on public.uploaded_files(session_id);
create index if not exists idx_rag_chunks_namespace on public.rag_chunks(pinecone_namespace);
create index if not exists idx_document_chunks_namespace on public.document_chunks(pinecone_namespace);
create index if not exists idx_website_sections_source on public.website_sections(source_id);

drop trigger if exists set_clients_updated_at on public.clients;
create trigger set_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();

drop trigger if exists set_chat_sessions_updated_at on public.chat_sessions;
create trigger set_chat_sessions_updated_at before update on public.chat_sessions for each row execute function public.set_updated_at();

drop trigger if exists set_service_categories_updated_at on public.service_categories;
create trigger set_service_categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();

drop trigger if exists set_onboarding_fields_updated_at on public.onboarding_fields;
create trigger set_onboarding_fields_updated_at before update on public.onboarding_fields for each row execute function public.set_updated_at();

drop trigger if exists set_client_requirements_updated_at on public.client_requirements;
create trigger set_client_requirements_updated_at before update on public.client_requirements for each row execute function public.set_updated_at();

drop trigger if exists set_client_requirement_values_updated_at on public.client_requirement_values;
create trigger set_client_requirement_values_updated_at before update on public.client_requirement_values for each row execute function public.set_updated_at();

drop trigger if exists set_project_briefs_updated_at on public.project_briefs;
create trigger set_project_briefs_updated_at before update on public.project_briefs for each row execute function public.set_updated_at();

drop trigger if exists set_prompt_templates_updated_at on public.prompt_templates;
create trigger set_prompt_templates_updated_at before update on public.prompt_templates for each row execute function public.set_updated_at();

drop trigger if exists set_model_settings_updated_at on public.model_settings;
create trigger set_model_settings_updated_at before update on public.model_settings for each row execute function public.set_updated_at();

drop trigger if exists set_website_json_sources_updated_at on public.website_json_sources;
create trigger set_website_json_sources_updated_at before update on public.website_json_sources for each row execute function public.set_updated_at();

drop trigger if exists set_website_sections_updated_at on public.website_sections;
create trigger set_website_sections_updated_at before update on public.website_sections for each row execute function public.set_updated_at();

drop trigger if exists set_rag_chunks_updated_at on public.rag_chunks;
create trigger set_rag_chunks_updated_at before update on public.rag_chunks for each row execute function public.set_updated_at();

drop trigger if exists set_document_sources_updated_at on public.document_sources;
create trigger set_document_sources_updated_at before update on public.document_sources for each row execute function public.set_updated_at();

drop trigger if exists set_document_chunks_updated_at on public.document_chunks;
create trigger set_document_chunks_updated_at before update on public.document_chunks for each row execute function public.set_updated_at();

drop trigger if exists set_sync_jobs_updated_at on public.sync_jobs;
create trigger set_sync_jobs_updated_at before update on public.sync_jobs for each row execute function public.set_updated_at();

drop trigger if exists set_sync_job_items_updated_at on public.sync_job_items;
create trigger set_sync_job_items_updated_at before update on public.sync_job_items for each row execute function public.set_updated_at();

insert into public.service_categories (name, slug, sort_order)
values
  ('Mortgage Automation', 'mortgage-automation', 10),
  ('Mortgage Website Development', 'mortgage-website-development', 20),
  ('Custom Mortgage Software', 'custom-mortgage-software', 30),
  ('MISMO Integration', 'mismo-integration', 40),
  ('Encompass Integration', 'encompass-integration', 50),
  ('BytePro Integration', 'bytepro-integration', 60),
  ('MeridianLink Integration', 'meridianlink-integration', 70),
  ('Power BI / Reporting', 'power-bi-reporting', 80),
  ('Salesforce Development', 'salesforce-development', 90),
  ('CRM Integration', 'crm-integration', 100),
  ('Custom Software Development', 'custom-software-development', 110),
  ('LOS Admin Services', 'los-admin-services', 120),
  ('Other', 'other', 130)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

insert into public.onboarding_fields (service_category_id, field_key, label, question, field_type, is_required, sort_order)
select sc.id, fields.field_key, fields.label, fields.question, fields.field_type, fields.is_required, fields.sort_order
from public.service_categories sc
cross join (
  values
    ('current_los_crm', 'Current LOS/CRM', 'Which LOS or CRM do you currently use?', 'text', true, 10),
    ('workflow_to_automate', 'Workflow to automate', 'Which workflow do you want to automate first?', 'textarea', true, 20),
    ('manual_steps', 'Manual steps', 'What manual steps does your team handle today?', 'textarea', true, 30),
    ('api_availability', 'API availability', 'Do you have API access or documentation available?', 'text', false, 40),
    ('data_fields_involved', 'Data fields involved', 'Which data fields are involved in the workflow?', 'textarea', false, 50),
    ('users_affected', 'Users affected', 'How many users or teams will this affect?', 'text', false, 60),
    ('current_bottlenecks', 'Current bottlenecks', 'Where does the current process slow down or break?', 'textarea', true, 70),
    ('screenshots_or_docs', 'Screenshots or workflow docs', 'Can you upload screenshots, workflow docs, or examples?', 'file', false, 80)
) as fields(field_key, label, question, field_type, is_required, sort_order)
where sc.slug = 'mortgage-automation'
on conflict (service_category_id, field_key) do update set
  label = excluded.label,
  question = excluded.question,
  field_type = excluded.field_type,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order;

insert into public.onboarding_fields (service_category_id, field_key, label, question, field_type, is_required, sort_order)
select sc.id, fields.field_key, fields.label, fields.question, fields.field_type, fields.is_required, fields.sort_order
from public.service_categories sc
cross join (
  values
    ('website_type', 'Website type', 'Is this for a lender, broker, branch, or loan officer website?', 'text', true, 10),
    ('pages_needed', 'Pages needed', 'Which pages do you need on the website?', 'textarea', true, 20),
    ('calculators_needed', 'Mortgage calculators', 'Do you need mortgage calculators?', 'text', false, 30),
    ('lead_forms', 'Lead forms', 'What lead forms should the website include?', 'textarea', true, 40),
    ('crm_integration', 'CRM integration', 'Should website leads go into a CRM or another system?', 'text', false, 50),
    ('content_ready', 'Content status', 'Do you already have website content ready?', 'text', false, 60),
    ('branding_ready', 'Branding status', 'Do you have logo, colors, and brand assets ready?', 'text', false, 70),
    ('reference_websites', 'Reference websites', 'Are there any reference websites you like?', 'textarea', false, 80)
) as fields(field_key, label, question, field_type, is_required, sort_order)
where sc.slug = 'mortgage-website-development'
on conflict (service_category_id, field_key) do update set
  label = excluded.label,
  question = excluded.question,
  field_type = excluded.field_type,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order;

insert into public.onboarding_fields (service_category_id, field_key, label, question, field_type, is_required, sort_order)
select sc.id, fields.field_key, fields.label, fields.question, fields.field_type, fields.is_required, fields.sort_order
from public.service_categories sc
cross join (
  values
    ('systems_involved', 'Systems involved', 'Which systems need to exchange MISMO data?', 'textarea', true, 10),
    ('mismo_version', 'MISMO version', 'Do you know which MISMO version is required?', 'text', false, 20),
    ('sample_xml', 'Sample XML', 'Can you provide sample XML files?', 'file', false, 30),
    ('field_mapping_needs', 'Field mapping needs', 'Do you already have field mapping requirements?', 'textarea', true, 40),
    ('validation_rules', 'Validation rules', 'Are there validation rules we should follow?', 'textarea', false, 50),
    ('receiving_system', 'Receiving system', 'Which system receives the final data?', 'text', true, 60),
    ('api_docs', 'API docs', 'Do you have API documentation available?', 'file', false, 70)
) as fields(field_key, label, question, field_type, is_required, sort_order)
where sc.slug = 'mismo-integration'
on conflict (service_category_id, field_key) do update set
  label = excluded.label,
  question = excluded.question,
  field_type = excluded.field_type,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order;

insert into public.onboarding_fields (service_category_id, field_key, label, question, field_type, is_required, sort_order)
select sc.id, fields.field_key, fields.label, fields.question, fields.field_type, fields.is_required, fields.sort_order
from public.service_categories sc
cross join (
  values
    ('data_sources', 'Data sources', 'Which data sources should be used for reporting?', 'textarea', true, 10),
    ('reports_needed', 'Reports needed', 'Which reports or dashboards do you need?', 'textarea', true, 20),
    ('kpis', 'KPIs', 'Which KPIs matter most?', 'textarea', true, 30),
    ('dashboard_users', 'Dashboard users', 'Who will use these dashboards?', 'text', false, 40),
    ('role_visibility', 'Role-based visibility', 'Do different users need different data visibility?', 'text', false, 50),
    ('refresh_frequency', 'Refresh frequency', 'How often should the reports refresh?', 'text', false, 60),
    ('sample_reports', 'Sample reports', 'Can you upload current Excel files or sample reports?', 'file', false, 70)
) as fields(field_key, label, question, field_type, is_required, sort_order)
where sc.slug = 'power-bi-reporting'
on conflict (service_category_id, field_key) do update set
  label = excluded.label,
  question = excluded.question,
  field_type = excluded.field_type,
  is_required = excluded.is_required,
  sort_order = excluded.sort_order;

insert into public.model_settings (task, provider, model, temperature)
values
  ('slm-routing', 'groq', 'llama-3.1-8b-instant', 0.1),
  ('llm-response', 'groq', 'llama-3.3-70b-versatile', 0.3)
on conflict (task) do update set
  provider = excluded.provider,
  model = excluded.model,
  temperature = excluded.temperature,
  is_active = true;

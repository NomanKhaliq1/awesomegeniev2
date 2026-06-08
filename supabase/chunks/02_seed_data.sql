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


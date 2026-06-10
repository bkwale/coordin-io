-- Coordin.io — Initial Database Schema
-- Run this in Supabase SQL Editor after creating your project
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ══════════════════════════════════════════════════════════════
-- ORGANISATIONS
-- ══════════════════════════════════════════════════════════════

create table public.organisations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text unique,
  logo_url text,
  address text,
  phone text,
  website text,
  default_currency text not null default 'GBP',
  default_vat_rate numeric(5,2) default 20.00,
  project_number_prefix text default 'P',
  quote_number_prefix text default 'QT',
  invoice_number_prefix text default 'INV',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- PROFILES (extends Supabase auth.users)
-- ══════════════════════════════════════════════════════════════

create type public.user_role as enum ('practice_owner', 'admin', 'project_lead', 'team_member');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organisation_id uuid references public.organisations(id) on delete set null,
  full_name text not null,
  email text not null,
  role user_role not null default 'team_member',
  job_title text,
  phone text,
  avatar_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- PROJECTS
-- ══════════════════════════════════════════════════════════════

create type public.project_status as enum ('active', 'paused', 'completed', 'archived');

create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  project_number text,
  name text not null,
  client text not null,
  description text,
  start_date date,
  target_completion_date date,
  current_stage smallint not null default 0 check (current_stage between 0 and 7),
  status project_status not null default 'active',
  project_lead_id uuid references public.profiles(id),
  created_by_id uuid references public.profiles(id),
  agreed_fee numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_projects_org on public.projects(organisation_id);
create index idx_projects_status on public.projects(status);

-- ══════════════════════════════════════════════════════════════
-- TASKS
-- ══════════════════════════════════════════════════════════════

create type public.task_status as enum ('not_started', 'in_progress', 'done', 'blocked');

create table public.tasks (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  stage smallint not null default 0 check (stage between 0 and 7),
  status task_status not null default 'not_started',
  owner_id uuid references public.profiles(id),
  due_date date,
  required_flag boolean not null default false,
  category text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tasks_project on public.tasks(project_id);
create index idx_tasks_owner on public.tasks(owner_id);

-- ══════════════════════════════════════════════════════════════
-- QUOTES
-- ══════════════════════════════════════════════════════════════

create type public.quote_status as enum (
  'draft', 'internal_review', 'ready_to_send', 'sent', 'viewed',
  'revised', 'accepted', 'declined', 'expired', 'superseded', 'converted_to_project'
);
create type public.quote_mode as enum ('existing_project', 'standalone');
create type public.quote_template_type as enum ('planning', 'technical', 'full_service', 'brpd', 'cdm_pd');

create table public.quotes (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  quote_reference text not null,
  quote_mode quote_mode not null default 'standalone',
  quote_template_type quote_template_type not null default 'planning',
  related_project_id uuid references public.projects(id),
  status quote_status not null default 'draft',
  client_name text not null,
  client_contact text,
  issue_date date,
  valid_until date not null,
  fee_basis text not null default 'fixed',
  total_fee numeric(12,2) not null default 0,
  currency text not null default 'GBP',
  -- Content
  project_summary text,
  scope_summary text,
  exclusions_text text,
  assumptions_text text,
  terms_text text,
  payment_terms_text text,
  acceptance_note text,
  -- Commercial assumptions
  meetings_included_count integer,
  meeting_type_notes text,
  mileage_rate numeric(6,2),
  travel_allowance numeric(10,2),
  expense_allowance numeric(10,2),
  design_freeze_flag boolean not null default false,
  design_freeze_wording text,
  deposit_required_flag boolean not null default false,
  deposit_amount numeric(10,2),
  brpd_role_flag boolean not null default false,
  cdm_pd_role_flag boolean not null default false,
  cgi_render_flag boolean not null default false,
  consultant_coordination_flag boolean not null default false,
  -- Tracking
  prepared_by_id uuid references public.profiles(id),
  sent_at timestamptz,
  sent_count integer not null default 0,
  viewed_count integer not null default 0,
  last_viewed_at timestamptz,
  accepted_at timestamptz,
  accepted_by text,
  declined_at timestamptz,
  -- Presentation
  accent_colour text,
  cover_image_url text,
  -- Timestamps
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_quotes_org on public.quotes(organisation_id);
create index idx_quotes_status on public.quotes(status);
create index idx_quotes_project on public.quotes(related_project_id);

-- ══════════════════════════════════════════════════════════════
-- QUOTE LINE ITEMS
-- ══════════════════════════════════════════════════════════════

create type public.quote_line_type as enum (
  'stage_service', 'additional_service', 'optional_service', 'consultant_coordination',
  'travel_mileage', 'expense_allowance', 'cgi_render', 'contract_admin',
  'interior_design', 'brpd_service', 'cdm_pd_service', 'other_custom'
);

create table public.quote_line_items (
  id uuid primary key default uuid_generate_v4(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  sort_order integer not null default 0,
  line_type quote_line_type not null default 'stage_service',
  title text not null,
  description text,
  related_stage smallint check (related_stage between 0 and 7),
  quantity numeric(10,2),
  unit text,
  rate numeric(10,2),
  amount numeric(12,2) not null default 0,
  optional_flag boolean not null default false,
  selected_by_default boolean not null default true,
  image_url text,
  created_at timestamptz not null default now()
);

create index idx_quote_items_quote on public.quote_line_items(quote_id);

-- ══════════════════════════════════════════════════════════════
-- QUOTE TEMPLATES
-- ══════════════════════════════════════════════════════════════

create table public.quote_templates (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  name text not null,
  template_type quote_template_type not null,
  description text,
  suitable_for text[],
  body_json jsonb not null default '{}'::jsonb,
  active_flag boolean not null default true,
  created_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- TIMESHEETS
-- ══════════════════════════════════════════════════════════════

create type public.timesheet_status as enum ('draft', 'submitted', 'approved', 'rejected');
create type public.timesheet_category as enum (
  'marketing_bid', 'strategic_definition', 'briefing', 'concept_design',
  'planning_spatial', 'technical_design', 'tender', 'construction_ca',
  'handover_use', 'admin_cpd_office'
);

create table public.timesheet_entries (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  task_id uuid references public.tasks(id),
  date date not null,
  hours numeric(4,2) not null check (hours > 0 and hours <= 24),
  description text,
  notes text,
  stage smallint not null default 0 check (stage between 0 and 7),
  task_category timesheet_category not null default 'admin_cpd_office',
  billable boolean not null default true,
  status timesheet_status not null default 'draft',
  submitted_at timestamptz,
  approved_by_id uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_timesheets_user on public.timesheet_entries(user_id);
create index idx_timesheets_project on public.timesheet_entries(project_id);
create index idx_timesheets_date on public.timesheet_entries(date);
create index idx_timesheets_org on public.timesheet_entries(organisation_id);

-- ══════════════════════════════════════════════════════════════
-- INVOICES
-- ══════════════════════════════════════════════════════════════

create type public.invoice_status as enum ('draft', 'sent', 'viewed', 'due', 'overdue', 'paid', 'void');

create table public.invoices (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  invoice_number text not null,
  project_id uuid references public.projects(id),
  quote_id uuid references public.quotes(id),
  client text not null,
  amount numeric(12,2) not null,
  vat_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null,
  status invoice_status not null default 'draft',
  issued_date date,
  due_date date not null,
  paid_date date,
  payment_reference text,
  xero_synced boolean not null default false,
  xero_invoice_id text,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_invoices_org on public.invoices(organisation_id);
create index idx_invoices_project on public.invoices(project_id);

-- ══════════════════════════════════════════════════════════════
-- LEAVE RECORDS
-- ══════════════════════════════════════════════════════════════

create type public.leave_type as enum ('holiday', 'sick', 'cpd', 'parental', 'compassionate', 'unpaid');
create type public.leave_status as enum ('pending', 'approved', 'declined', 'cancelled');

create table public.leave_records (
  id uuid primary key default uuid_generate_v4(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  leave_type leave_type not null,
  start_date date not null,
  end_date date not null,
  days numeric(4,1) not null,
  status leave_status not null default 'pending',
  notes text,
  approved_by_id uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- WAITLIST (for landing page form submissions)
-- ══════════════════════════════════════════════════════════════

create table public.waitlist (
  id uuid primary key default uuid_generate_v4(),
  email text not null,
  name text,
  practice_name text,
  role text,
  practice_size text,
  demo_interests text[],
  current_tools text,
  source text default 'website',
  created_at timestamptz not null default now()
);

-- ══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS)
-- ══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
alter table public.organisations enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.quote_templates enable row level security;
alter table public.timesheet_entries enable row level security;
alter table public.invoices enable row level security;
alter table public.leave_records enable row level security;
alter table public.waitlist enable row level security;

-- ── Helper function: get current user's org_id ──────────────

create or replace function public.get_user_org_id()
returns uuid
language sql
security definer
stable
as $$
  select organisation_id from public.profiles where id = auth.uid()
$$;

-- ── Profiles: users can read their own org's profiles ───────

create policy "Users can view own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "Users can view org profiles"
  on public.profiles for select
  using (organisation_id = public.get_user_org_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- ── Organisations: members can view their own org ───────────

create policy "Members can view own org"
  on public.organisations for select
  using (id = public.get_user_org_id());

create policy "Owners can update own org"
  on public.organisations for update
  using (id = public.get_user_org_id());

-- ── Projects: org-scoped ────────────────────────────────────

create policy "Org members can view projects"
  on public.projects for select
  using (organisation_id = public.get_user_org_id());

create policy "Org members can create projects"
  on public.projects for insert
  with check (organisation_id = public.get_user_org_id());

create policy "Org members can update projects"
  on public.projects for update
  using (organisation_id = public.get_user_org_id());

-- ── Tasks: via project's org ────────────────────────────────

create policy "Org members can view tasks"
  on public.tasks for select
  using (
    project_id in (
      select id from public.projects where organisation_id = public.get_user_org_id()
    )
  );

create policy "Org members can manage tasks"
  on public.tasks for all
  using (
    project_id in (
      select id from public.projects where organisation_id = public.get_user_org_id()
    )
  );

-- ── Quotes: org-scoped ──────────────────────────────────────

create policy "Org members can view quotes"
  on public.quotes for select
  using (organisation_id = public.get_user_org_id());

create policy "Org members can manage quotes"
  on public.quotes for all
  using (organisation_id = public.get_user_org_id());

-- ── Quote line items: via quote's org ───────────────────────

create policy "Org members can view quote items"
  on public.quote_line_items for select
  using (
    quote_id in (
      select id from public.quotes where organisation_id = public.get_user_org_id()
    )
  );

create policy "Org members can manage quote items"
  on public.quote_line_items for all
  using (
    quote_id in (
      select id from public.quotes where organisation_id = public.get_user_org_id()
    )
  );

-- ── Quote templates: org-scoped ─────────────────────────────

create policy "Org members can view templates"
  on public.quote_templates for select
  using (organisation_id = public.get_user_org_id());

create policy "Org members can manage templates"
  on public.quote_templates for all
  using (organisation_id = public.get_user_org_id());

-- ── Timesheets: org-scoped ──────────────────────────────────

create policy "Org members can view timesheets"
  on public.timesheet_entries for select
  using (organisation_id = public.get_user_org_id());

create policy "Users can create own timesheets"
  on public.timesheet_entries for insert
  with check (user_id = auth.uid() and organisation_id = public.get_user_org_id());

create policy "Users can update own timesheets"
  on public.timesheet_entries for update
  using (user_id = auth.uid() and organisation_id = public.get_user_org_id());

-- ── Invoices: org-scoped ────────────────────────────────────

create policy "Org members can view invoices"
  on public.invoices for select
  using (organisation_id = public.get_user_org_id());

create policy "Org members can manage invoices"
  on public.invoices for all
  using (organisation_id = public.get_user_org_id());

-- ── Leave records: org-scoped ───────────────────────────────

create policy "Org members can view leave"
  on public.leave_records for select
  using (organisation_id = public.get_user_org_id());

create policy "Users can create own leave"
  on public.leave_records for insert
  with check (user_id = auth.uid() and organisation_id = public.get_user_org_id());

-- ── Waitlist: anyone can insert (public form), only service role reads ──

create policy "Anyone can submit waitlist"
  on public.waitlist for insert
  with check (true);

-- ══════════════════════════════════════════════════════════════
-- TRIGGERS: auto-update updated_at
-- ══════════════════════════════════════════════════════════════

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.organisations
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.projects
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.tasks
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.quotes
  for each row execute function public.handle_updated_at();

create trigger set_updated_at before update on public.invoices
  for each row execute function public.handle_updated_at();

-- ══════════════════════════════════════════════════════════════
-- AUTO-CREATE PROFILE ON SIGNUP
-- ══════════════════════════════════════════════════════════════

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'team_member'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

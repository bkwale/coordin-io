-- S4.2: AI failure kinds + central error log. Additive only.
alter table ai_runs add column if not exists error_kind text;
alter table ai_runs add column if not exists error_detail text;

create table if not exists error_events (
  id text primary key,
  ref text not null unique,
  fingerprint text not null,
  level text not null default 'error',
  source text not null,
  route text,
  method text,
  status_code integer,
  code text,
  message text not null,
  stack text,
  organisation_id text,
  profile_id text,
  run_id text,
  context jsonb,
  release text,
  created_at timestamptz not null default now()
);
create index if not exists error_events_fingerprint_created_at_idx on error_events (fingerprint, created_at);
create index if not exists error_events_created_at_idx on error_events (created_at);
create index if not exists error_events_organisation_id_created_at_idx on error_events (organisation_id, created_at);
alter table error_events enable row level security;

-- Applied to production 2026-11-05. probation_goals existed in schema.prisma (Sprint 2.5) but was never
-- created in the database, so every probation review list (which counts goals) failed with P2021.
create table if not exists public.probation_goals (
  id text primary key,
  review_id text not null references public.probation_reviews(id) on delete cascade on update cascade,
  title text not null,
  description text,
  target_date timestamp(3),
  status text not null default 'NOT_STARTED',
  evidence text,
  completed_at timestamp(3),
  sort_order integer not null default 0,
  created_at timestamp(3) not null default current_timestamp,
  updated_at timestamp(3) not null
);
create index if not exists probation_goals_review_id_idx on public.probation_goals(review_id);
alter table public.probation_goals enable row level security;

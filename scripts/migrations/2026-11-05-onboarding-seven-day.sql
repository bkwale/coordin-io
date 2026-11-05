-- Seven-day onboarding framework (Ayo, Coordin bug 10, sections 1.2-1.6). Additive only.
ALTER TABLE onboarding_templates      ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'CORE';
ALTER TABLE onboarding_template_items ADD COLUMN IF NOT EXISTS applies_to text NOT NULL DEFAULT 'ALL';
ALTER TABLE onboarding_assignments
  ADD COLUMN IF NOT EXISTS employee_type text NOT NULL DEFAULT 'NEW',
  ADD COLUMN IF NOT EXISTS add_on_template_ids text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS window_days integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS window_start_at timestamp(3),
  ADD COLUMN IF NOT EXISTS window_due_at timestamp(3),
  ADD COLUMN IF NOT EXISTS reminders_sent integer[] NOT NULL DEFAULT ARRAY[]::integer[],
  ADD COLUMN IF NOT EXISTS missed_notified_at timestamp(3),
  ADD COLUMN IF NOT EXISTS submitted_at timestamp(3),
  ADD COLUMN IF NOT EXISTS verified_at timestamp(3),
  ADD COLUMN IF NOT EXISTS verified_by_id text;
ALTER TABLE onboarding_tasks
  ADD COLUMN IF NOT EXISTS responsible_role text,
  ADD COLUMN IF NOT EXISTS source_template_id text;

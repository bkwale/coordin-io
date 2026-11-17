-- Risk flags a person has set aside, with their reason. Additive: one new table, nothing else touched.
CREATE TABLE IF NOT EXISTS public.risk_dismissals (
  id            text PRIMARY KEY,
  project_id    text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  signal_id     text NOT NULL,
  kind          text NOT NULL,
  severity      text NOT NULL,
  title         text NOT NULL,
  reason        text NOT NULL,
  dismissed_by  text NOT NULL,
  dismissed_at  timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  restored_by   text,
  restored_at   timestamp(3)
);
CREATE UNIQUE INDEX IF NOT EXISTS risk_dismissals_project_id_signal_id_key ON public.risk_dismissals (project_id, signal_id);
CREATE INDEX IF NOT EXISTS risk_dismissals_project_id_idx ON public.risk_dismissals (project_id);
ALTER TABLE public.risk_dismissals ENABLE ROW LEVEL SECURITY;

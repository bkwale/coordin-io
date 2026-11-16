-- Merit Aktiva connection (Estonia). Additive: one new table, nothing else touched.
-- RLS on with no policies, like the other integration tables: the app connects as postgres, REST access is blocked.
CREATE TABLE IF NOT EXISTS public.merit_connections (
  id               text PRIMARY KEY,
  organisation_id  text NOT NULL REFERENCES public.organisations(id),
  api_id           text NOT NULL,
  api_key          text NOT NULL,
  default_tax_id   text,
  default_tax_name text,
  default_tax_pct  double precision,
  zero_tax_id      text,
  item_code        text NOT NULL DEFAULT 'TEENUS',
  send_e_invoice   boolean NOT NULL DEFAULT false,
  last_checked_at  timestamp(3),
  last_sync_at     timestamp(3),
  last_sync_error  text,
  connected_at     timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  connected_by_id  text NOT NULL REFERENCES public.profiles(id),
  disconnected_at  timestamp(3),
  active           boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS merit_connections_organisation_id_active_idx ON public.merit_connections (organisation_id, active);
ALTER TABLE public.merit_connections ENABLE ROW LEVEL SECURITY;

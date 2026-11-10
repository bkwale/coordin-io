-- Applied 2026-11-10 (security review). 23 public tables were reachable with the anon key via PostgREST.
-- The app connects as postgres (BYPASSRLS), so RLS without policies only blocks REST access.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['support_tickets','support_ticket_replies','xero_sync_logs','microsoft_sync_logs','public_holidays','fee_quote_line_items','fee_quotes','approval_instances','task_dependencies','approval_step_instances','external_links','blackout_dates','approval_routes','leave_policies','asset_condition_history','service_request_items','organisation_features','stage_gates','project_brief_sections','xero_connections','microsoft_connections','integration_sync_logs','approval_route_steps']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_user_org_id() FROM anon, public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.update_confidential_updated_at() SET search_path = public;

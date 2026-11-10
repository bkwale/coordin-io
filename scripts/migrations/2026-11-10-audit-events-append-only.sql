-- Audit trail is append-only. Additive: a trigger, no data change.
-- The one UPDATE allowed is the FK's ON DELETE SET NULL when a profile is removed
-- (actor_id → null, every other column unchanged).
create or replace function public.audit_events_append_only()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.actor_id is null and old.actor_id is not null
     and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
    return new;
  end if;
  raise exception 'audit_events is append-only (% blocked)', tg_op using errcode = '42501';
end $$;

drop trigger if exists audit_events_append_only on public.audit_events;
create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function public.audit_events_append_only();

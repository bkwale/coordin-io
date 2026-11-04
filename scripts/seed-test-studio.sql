-- Test studio for preview/staging testing. Fictional practice, fictional projects.
-- Keeps test data out of real customer orgs (preview shares the production database).
--
-- Re-runnable: fixed ids + ON CONFLICT DO NOTHING. A fresh owner invitation is issued only
-- while no owner has activated. The login is created through the normal /activate/[token]
-- flow, so the password is set by the person activating — never stored here.
--
-- Run step 1, open /activate/<token>, then run step 2.

-- ── Step 1: org, office, features, projects, owner invitation ───────────────
insert into organisations (id, name, slug, default_currency, currencies, updated_at, subscription_plan, subscription_status, settings)
values ('tst_org', 'Testbüroo OÜ (TEST)', 'testburoo-test', 'EUR', '{EUR}', now(), 'pro', 'active', '{"isTestOrg": true}')
on conflict (id) do nothing;

insert into offices (id, organisation_id, name, city, country, is_head_office)
values ('tst_office', 'tst_org', 'Tallinn', 'Tallinn', 'EE', true)
on conflict (id) do nothing;

-- every feature on, so every module can be tested
insert into organisation_features (id, organisation_id, feature_key, enabled, enabled_at, updated_at)
select 'tst_feat_' || k, 'tst_org', k, true, now(), now()
from unnest(array['staffing','projects','commercial','timesheets','spend_management','helpdesk','compliance','documents','approvals','invoicing','riba_tracking']) k
on conflict (id) do nothing;

-- system profile: the invitation needs a creator. No login, deactivated, never a real user.
insert into profiles (id, organisation_id, office_id, full_name, email, "orgPermission", status, deactivated_at, updated_at)
values ('tst_system', 'tst_org', 'tst_office', 'Coordin setup (system)', 'system+testburoo@coordin.invalid', 'ADMIN', 'DEACTIVATED', now(), now())
on conflict (id) do nothing;

-- fictional Estonian projects (no real addresses, cadastral numbers or EHR codes)
insert into projects (id, organisation_id, office_id, code, name, description, location, project_type, stage, status, currency, site_address, site_city, site_country, building_type, jurisdiction, development_type, gross_floor_area, number_of_floors, updated_at)
values
  ('tst_proj_house', 'tst_org', 'tst_office', 'TST-01', 'Männiku eramu (TEST)', 'Fictional detached house — use for planning-conditions PDF upload tests.', 'Testküla, Harju maakond', 'RESIDENTIAL', 'BRIEF', 'ACTIVE', 'EUR', 'Proovi tee 1', 'Testküla', 'Estonia', 'Residential', 'EE', 'NEW_BUILD', 180, 2, now()),
  ('tst_proj_flats', 'tst_org', 'tst_office', 'TST-02', 'Kase korterelamu (TEST)', 'Fictional apartment block — use for rule-set / storeys / fire tests.', 'Näidislinn, Tartu maakond', 'RESIDENTIAL', 'BRIEF', 'ACTIVE', 'EUR', 'Näidise 12', 'Näidislinn', 'Estonia', 'Residential', 'EE', 'NEW_BUILD', 2400, 5, now()),
  ('tst_proj_refurb', 'tst_org', 'tst_office', 'TST-03', 'Vana kooli renoveerimine (TEST)', 'Fictional refurbishment — use for heritage / change-of-use tests.', 'Proovivald, Pärnu maakond', 'REFURBISHMENT', 'BRIEF', 'ACTIVE', 'EUR', 'Kooli 3', 'Proovivald', 'Estonia', 'Education', 'EE', 'REFURBISHMENT', 950, 2, now())
on conflict (id) do nothing;

-- owner invitation (14 days); a new one only if none is pending and nobody has activated
insert into invitations (id, organisation_id, token, email, full_name, job_title, office_id, org_permission, status, expires_at, created_by_id)
select 'tst_inv_' || substr(md5(random()::text), 1, 10), 'tst_org', encode(gen_random_bytes(32), 'hex'),
       'wale+test@techsanctum.org', 'Wale (Test Studio)', 'Founding architect', 'tst_office', 'OWNER', 'SENT', now() + interval '14 days', 'tst_system'
where not exists (select 1 from invitations where organisation_id = 'tst_org' and status in ('PENDING','SENT','ACTIVATED') and expires_at > now())
  and not exists (select 1 from profiles where organisation_id = 'tst_org' and auth_user_id is not null);

select token, email, expires_at from invitations where organisation_id = 'tst_org' and status in ('PENDING','SENT') order by created_at desc limit 1;

-- ── Step 2 (after activation): skip the onboarding wizard, make owner project lead ──
-- update profiles set status = 'ACTIVE', updated_at = now()
--   where organisation_id = 'tst_org' and auth_user_id is not null and status = 'ONBOARDING';
-- insert into project_memberships (id, project_id, profile_id, project_role)
--   select 'tst_pm_' || p.id, p.id, o.id, 'PROJECT_LEAD'
--   from projects p cross join profiles o
--   where p.organisation_id = 'tst_org' and o.organisation_id = 'tst_org' and o.auth_user_id is not null
-- on conflict (project_id, profile_id) do nothing;

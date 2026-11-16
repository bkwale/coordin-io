-- Clears salary/benefits/HMO/pension/notice data from the OLD employee_profiles columns.
-- The same values live in confidential_employee_data (the protected table). Approved by Wale, 11 Nov 2026.
-- RUN ONLY AFTER the security-hardening branch is live: the code before it still writes these columns on
-- every profile save and reads notice_period from here for the payroll export.
-- Safe to re-run. Clears a row only when the protected table holds every value it is about to remove.

-- 1. Copy anything the protected table is missing (no overwrite)
insert into confidential_employee_data (id, profile_id, bank_verified, created_at, updated_at)
select 'c' || replace(gen_random_uuid()::text, '-', ''), ep.profile_id, false, now(), now()
from employee_profiles ep
where not exists (select 1 from confidential_employee_data c where c.profile_id = ep.profile_id)
  and (ep.salary is not null or ep.salary_frequency is not null or ep.salary_currency is not null or ep.benefits is not null
    or ep.hmo_provider is not null or ep.hmo_plan is not null or coalesce(ep.dependants, 0) > 0
    or ep.pension_provider is not null or ep.pension_contribution is not null or ep.notice_period is not null);

update confidential_employee_data c set
  salary = coalesce(c.salary, ep.salary),
  salary_frequency = coalesce(c.salary_frequency, ep.salary_frequency),
  salary_currency = coalesce(c.salary_currency, ep.salary_currency),
  benefits = coalesce(c.benefits, ep.benefits),
  hmo_provider = coalesce(c.hmo_provider, ep.hmo_provider),
  hmo_plan = coalesce(c.hmo_plan, ep.hmo_plan),
  dependants = case when coalesce(c.dependants, 0) = 0 then ep.dependants else c.dependants end,
  pension_provider = coalesce(c.pension_provider, ep.pension_provider),
  pension_contribution = coalesce(c.pension_contribution, ep.pension_contribution),
  notice_period = coalesce(c.notice_period, ep.notice_period)
from employee_profiles ep
where ep.profile_id = c.profile_id;

-- 2. Clear the old columns
update employee_profiles ep set
  salary = null, salary_frequency = null, salary_currency = null, benefits = null,
  hmo_provider = null, hmo_plan = null, dependants = 0,
  pension_provider = null, pension_contribution = null, notice_period = null
where exists (select 1 from confidential_employee_data c where c.profile_id = ep.profile_id)
  and (ep.salary is not null or ep.salary_frequency is not null or ep.salary_currency is not null or ep.benefits is not null
    or ep.hmo_provider is not null or ep.hmo_plan is not null or coalesce(ep.dependants, 0) > 0
    or ep.pension_provider is not null or ep.pension_contribution is not null or ep.notice_period is not null);

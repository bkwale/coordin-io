-- Trust Release 9: HR data separation
-- Create confidential_employee_data table to isolate salary/benefits/pension
-- from the general employee_profiles table.

CREATE TABLE IF NOT EXISTS public.confidential_employee_data (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Compensation
  salary DOUBLE PRECISION,
  salary_frequency TEXT,
  salary_currency TEXT,
  benefits TEXT,
  -- Insurance & Health
  hmo_provider TEXT,
  hmo_plan TEXT,
  dependants INTEGER DEFAULT 0,
  -- Pension
  pension_provider TEXT,
  pension_contribution DOUBLE PRECISION,
  -- Contract
  notice_period TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Copy existing confidential data from employee_profiles
INSERT INTO public.confidential_employee_data (
  id, profile_id, salary, salary_frequency, salary_currency, benefits,
  hmo_provider, hmo_plan, dependants, pension_provider, pension_contribution,
  notice_period
)
SELECT
  gen_random_uuid()::text,
  profile_id, salary, salary_frequency, salary_currency, benefits,
  hmo_provider, hmo_plan, dependants, pension_provider, pension_contribution,
  notice_period
FROM public.employee_profiles
WHERE salary IS NOT NULL
   OR benefits IS NOT NULL
   OR hmo_provider IS NOT NULL
   OR pension_provider IS NOT NULL
   OR notice_period IS NOT NULL
ON CONFLICT (profile_id) DO NOTHING;

-- Enable RLS — defense-in-depth
ALTER TABLE public.confidential_employee_data ENABLE ROW LEVEL SECURITY;

-- Only service_role can access (Prisma connects as service_role via pooler)
-- This blocks direct access via anon/authenticated keys
CREATE POLICY "service_role_only" ON public.confidential_employee_data
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Note: profile_id already has a UNIQUE constraint which creates an implicit index

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_confidential_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_confidential_updated_at
  BEFORE UPDATE ON public.confidential_employee_data
  FOR EACH ROW
  EXECUTE FUNCTION update_confidential_updated_at();

-- Probation review workflow (additive). Manager drafts → submits to HR → HR returns or finalises.
ALTER TABLE "probation_reviews"
  ADD COLUMN IF NOT EXISTS "workflow_status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN IF NOT EXISTS "assessment" JSONB,
  ADD COLUMN IF NOT EXISTS "employee_feedback" TEXT,
  ADD COLUMN IF NOT EXISTS "improvement_objectives" TEXT,
  ADD COLUMN IF NOT EXISTS "manager_recommendation" TEXT,
  ADD COLUMN IF NOT EXISTS "hr_decision" TEXT,
  ADD COLUMN IF NOT EXISTS "evidence" JSONB,
  ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "submitted_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "returned_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "returned_by_id" TEXT,
  ADD COLUMN IF NOT EXISTS "return_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "finalised_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "finalised_by_id" TEXT;
-- Already-completed reviews are finalised records.
UPDATE "probation_reviews" SET "workflow_status" = 'FINALISED', "hr_decision" = COALESCE("hr_decision", "outcome"), "finalised_at" = COALESCE("finalised_at", "completed_date")
  WHERE "completed_date" IS NOT NULL AND "workflow_status" = 'SCHEDULED';
CREATE INDEX IF NOT EXISTS "probation_reviews_workflow_status_idx" ON "probation_reviews"("workflow_status");

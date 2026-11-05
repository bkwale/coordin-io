-- FEAT-017 delivery frameworks (additive)
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "delivery_framework" TEXT, ADD COLUMN IF NOT EXISTS "accor_overlay" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "delivery_stages" (
  "id" TEXT PRIMARY KEY, "project_id" TEXT NOT NULL REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "framework" TEXT NOT NULL, "template_version" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "outcome" TEXT, "purpose" TEXT,
  "sort_order" INTEGER NOT NULL, "status" TEXT NOT NULL DEFAULT 'NOT_STARTED', "design_freeze" BOOLEAN NOT NULL DEFAULT false, "frozen_at" TIMESTAMP(3),
  "lead_id" TEXT, "planned_start" TIMESTAMP(3), "planned_end" TIMESTAMP(3), "actual_start" TIMESTAMP(3), "actual_end" TIMESTAMP(3),
  "decision" TEXT, "decision_notes" TEXT, "decided_by_id" TEXT, "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "delivery_stages_project_id_sort_order_idx" ON "delivery_stages"("project_id", "sort_order");
CREATE TABLE IF NOT EXISTS "delivery_stage_items" (
  "id" TEXT PRIMARY KEY, "stage_id" TEXT NOT NULL REFERENCES "delivery_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "kind" TEXT NOT NULL, "title" TEXT NOT NULL, "responsible_party" TEXT, "assignee_id" TEXT, "due_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN', "is_open_item" BOOLEAN NOT NULL DEFAULT false, "document_url" TEXT, "notes" TEXT,
  "completed_at" TIMESTAMP(3), "completed_by_id" TEXT, "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "delivery_stage_items_stage_id_kind_idx" ON "delivery_stage_items"("stage_id", "kind");
ALTER TABLE "delivery_stages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_stage_items" ENABLE ROW LEVEL SECURITY;

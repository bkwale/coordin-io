-- Add organisation_id to training_items for multi-tenant isolation
-- Bug #3: Training data was leaking across organisations

ALTER TABLE training_items
ADD COLUMN organisation_id TEXT;

-- Backfill existing training items with CWA HOMES org ID
UPDATE training_items
SET organisation_id = 'd98a3d14-a3c7-4df7-a7ac-8e1065356e1a'
WHERE organisation_id IS NULL;

-- Now make it NOT NULL
ALTER TABLE training_items
ALTER COLUMN organisation_id SET NOT NULL;

-- Add foreign key constraint
ALTER TABLE training_items
ADD CONSTRAINT training_items_organisation_id_fkey
FOREIGN KEY (organisation_id) REFERENCES organisations(id) ON DELETE CASCADE;

-- Add index for org-scoped queries
CREATE INDEX idx_training_items_organisation_id ON training_items(organisation_id);

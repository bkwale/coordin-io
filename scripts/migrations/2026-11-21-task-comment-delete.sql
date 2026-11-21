-- Task comments can be deleted (support ticket #05FGXS). Additive: two nullable columns, nothing existing changes.
-- A deleted comment is hidden from the task, not erased.
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS deleted_at timestamptz(3);
ALTER TABLE task_comments ADD COLUMN IF NOT EXISTS deleted_by text;

-- S4.1b — convert the remaining 365-day signed file links to stable /api/files links.
-- Run AFTER the S4.1 code is live in production (/api/files must exist). Not destructive:
-- the file stays where it is; only the stored link changes. Old links keep working until they expire anyway.
-- 7 Nov 2026: 1 row in document_revisions, 1 row in hr_documents, 0 in expense_claims (kept for safety).
-- Drawing revisions and task/update attachment JSON held no signed links on 7 Nov; re-check before running.
UPDATE document_revisions
SET file_url = '/api/files?b=' || substring(file_url from '/storage/v1/object/sign/([^/?]+)/') || '&p=' || substring(file_url from '/storage/v1/object/sign/[^/?]+/([^?]+)')
WHERE file_url LIKE '%/storage/v1/object/sign/documents/%';

UPDATE hr_documents
SET file_url = '/api/files?b=' || substring(file_url from '/storage/v1/object/sign/([^/?]+)/') || '&p=' || substring(file_url from '/storage/v1/object/sign/[^/?]+/([^?]+)')
WHERE file_url LIKE '%/storage/v1/object/sign/documents/%';

UPDATE expense_claims
SET receipt_url = '/api/files?b=' || substring(receipt_url from '/storage/v1/object/sign/([^/?]+)/') || '&p=' || substring(receipt_url from '/storage/v1/object/sign/[^/?]+/([^?]+)')
WHERE receipt_url LIKE '%/storage/v1/object/sign/receipts/%';

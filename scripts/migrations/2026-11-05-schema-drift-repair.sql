-- 2026-11-05 Schema drift repair. Found by comparing schema.prisma with production (every table/column/enum).
-- Additive only: no data dropped. Applied via Supabase migration "schema_drift_repair_2026_11_05".

-- 1. Approvals (Sprint 2.2/2.3 CC + multi-approver columns never reached the DB → /api/approvals 500)
ALTER TABLE "approval_instances" ADD COLUMN IF NOT EXISTS "cc_recipient_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "approval_step_instances" ADD COLUMN IF NOT EXISTS "approver_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "approval_step_instances" ADD COLUMN IF NOT EXISTS "approved_by_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
UPDATE "approval_step_instances" SET "approver_ids" = ARRAY["approver_id"] WHERE "approver_id" IS NOT NULL AND cardinality(coalesce("approver_ids", ARRAY[]::TEXT[])) = 0;

-- 2. Missing enum values
ALTER TYPE "FeeQuoteStatus" ADD VALUE IF NOT EXISTS 'INVOICED';
ALTER TYPE "ApprovalRequestType" ADD VALUE IF NOT EXISTS 'INBOUND_INVOICE';

-- 3. Invoicing module (suppliers, inbound/outbound invoices, categorisation rules) — generated from schema.prisma
CREATE TYPE "inbound_document_type" AS ENUM ('INVOICE', 'CREDIT_NOTE');
CREATE TYPE "inbound_invoice_source" AS ENUM ('PEPPOL', 'PDF_UPLOAD', 'IMAGE_UPLOAD', 'EMAIL', 'MANUAL_ENTRY');
CREATE TYPE "inbound_invoice_status" AS ENUM ('RECEIVED', 'CATEGORISED', 'PENDING_REVIEW', 'APPROVED', 'SYNCED', 'PAID', 'REJECTED', 'VOIDED');
CREATE TYPE "outbound_invoice_status" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'PAID', 'OVERDUE', 'VOIDED', 'CREDITED');
CREATE TYPE "XeroSyncDirection" AS ENUM ('TO_XERO', 'FROM_XERO');
CREATE TYPE "MicrosoftSyncDirection" AS ENUM ('TO_MICROSOFT', 'FROM_MICROSOFT');
CREATE TYPE "MicrosoftService" AS ENUM ('CALENDAR', 'FILES', 'MAIL');
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vat_number" TEXT,
    "peppol_id" TEXT,
    "country" TEXT,
    "address" TEXT,
    "default_account_code" TEXT,
    "payment_terms_days" INTEGER,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "xero_contact_id" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inbound_invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "supplier_id" TEXT,
    "project_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "document_type" "inbound_document_type" NOT NULL DEFAULT 'INVOICE',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'EUR',
    "net_amount" DOUBLE PRECISION NOT NULL,
    "vat_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gross_amount" DOUBLE PRECISION NOT NULL,
    "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
    "vat_exemption_reason" TEXT,
    "vat_breakdown" JSONB,
    "source" "inbound_invoice_source" NOT NULL DEFAULT 'MANUAL_ENTRY',
    "source_file_url" TEXT,
    "peppol_message_id" TEXT,
    "raw_xml" TEXT,
    "parsed_supplier_name" TEXT,
    "parsed_supplier_vat" TEXT,
    "parsed_buyer_name" TEXT,
    "parsed_buyer_vat" TEXT,
    "linked_invoice_number" TEXT,
    "overall_confidence" DOUBLE PRECISION,
    "unmatched_lines" INTEGER NOT NULL DEFAULT 0,
    "status" "inbound_invoice_status" NOT NULL DEFAULT 'RECEIVED',
    "approval_instance_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "approved_by_id" TEXT,
    "accounting_system" TEXT,
    "external_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "parse_errors" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "inbound_invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "inbound_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "line_total" DOUBLE PRECISION NOT NULL,
    "vat_exemption_reason" TEXT,
    "account_code" TEXT,
    "suggested_account_code" TEXT,
    "account_code_confidence" DOUBLE PRECISION,
    "rule_id" TEXT,
    "cost_code" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbound_invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "categorisation_rules" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "project_id" TEXT,
    "supplier_id" TEXT,
    "keyword" TEXT,
    "account_code" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorisation_rules_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "outbound_invoices" (
    "id" TEXT NOT NULL,
    "organisation_id" TEXT NOT NULL,
    "source_quote_id" TEXT,
    "supplier_id" TEXT,
    "project_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "document_type" "inbound_document_type" NOT NULL DEFAULT 'INVOICE',
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "due_date" TIMESTAMP(3),
    "currency" "Currency" NOT NULL DEFAULT 'GBP',
    "net_amount" DOUBLE PRECISION NOT NULL,
    "vat_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gross_amount" DOUBLE PRECISION NOT NULL,
    "tax_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "client_name" TEXT NOT NULL,
    "client_email" TEXT,
    "client_address" TEXT,
    "status" "outbound_invoice_status" NOT NULL DEFAULT 'DRAFT',
    "sent_at" TIMESTAMP(3),
    "viewed_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "notes" TEXT,
    "terms_and_conditions" TEXT,
    "ubl_xml" TEXT,
    "accounting_system" TEXT,
    "external_id" TEXT,
    "synced_at" TIMESTAMP(3),
    "sync_error" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_invoices_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "outbound_invoice_lines" (
    "id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "vat_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "line_total" DOUBLE PRECISION NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outbound_invoice_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "suppliers_organisation_id_idx" ON "suppliers"("organisation_id");
CREATE INDEX "suppliers_organisation_id_name_idx" ON "suppliers"("organisation_id", "name");
CREATE UNIQUE INDEX "suppliers_organisation_id_vat_number_key" ON "suppliers"("organisation_id", "vat_number");
CREATE INDEX "inbound_invoices_organisation_id_status_idx" ON "inbound_invoices"("organisation_id", "status");
CREATE INDEX "inbound_invoices_organisation_id_supplier_id_idx" ON "inbound_invoices"("organisation_id", "supplier_id");
CREATE INDEX "inbound_invoices_organisation_id_project_id_idx" ON "inbound_invoices"("organisation_id", "project_id");
CREATE INDEX "inbound_invoices_invoice_date_idx" ON "inbound_invoices"("invoice_date");
CREATE INDEX "inbound_invoice_lines_invoice_id_idx" ON "inbound_invoice_lines"("invoice_id");
CREATE INDEX "categorisation_rules_organisation_id_idx" ON "categorisation_rules"("organisation_id");
CREATE INDEX "categorisation_rules_organisation_id_supplier_id_idx" ON "categorisation_rules"("organisation_id", "supplier_id");
CREATE UNIQUE INDEX "outbound_invoices_source_quote_id_key" ON "outbound_invoices"("source_quote_id");
CREATE INDEX "outbound_invoices_organisation_id_status_idx" ON "outbound_invoices"("organisation_id", "status");
CREATE INDEX "outbound_invoices_organisation_id_project_id_idx" ON "outbound_invoices"("organisation_id", "project_id");
CREATE INDEX "outbound_invoices_invoice_date_idx" ON "outbound_invoices"("invoice_date");
CREATE INDEX "outbound_invoice_lines_invoice_id_idx" ON "outbound_invoice_lines"("invoice_id");
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoices" ADD CONSTRAINT "inbound_invoices_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inbound_invoice_lines" ADD CONSTRAINT "inbound_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "inbound_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categorisation_rules" ADD CONSTRAINT "categorisation_rules_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "categorisation_rules" ADD CONSTRAINT "categorisation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "categorisation_rules" ADD CONSTRAINT "categorisation_rules_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_invoices" ADD CONSTRAINT "outbound_invoices_organisation_id_fkey" FOREIGN KEY ("organisation_id") REFERENCES "organisations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_invoices" ADD CONSTRAINT "outbound_invoices_source_quote_id_fkey" FOREIGN KEY ("source_quote_id") REFERENCES "fee_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_invoices" ADD CONSTRAINT "outbound_invoices_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_invoices" ADD CONSTRAINT "outbound_invoices_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "outbound_invoices" ADD CONSTRAINT "outbound_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "outbound_invoice_lines" ADD CONSTRAINT "outbound_invoice_lines_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "outbound_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "suppliers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbound_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inbound_invoice_lines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "categorisation_rules" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbound_invoices" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "outbound_invoice_lines" ENABLE ROW LEVEL SECURITY;

-- 4. Integration sync logs: old layout (both tables empty). Add the columns the code writes; relax old required ones.
ALTER TABLE "xero_sync_logs" ALTER COLUMN "direction" DROP DEFAULT;
ALTER TABLE "xero_sync_logs" ALTER COLUMN "direction" TYPE "XeroSyncDirection" USING NULL;
ALTER TABLE "xero_sync_logs" ALTER COLUMN "organisation_id" DROP NOT NULL, ALTER COLUMN "sync_type" DROP NOT NULL;
ALTER TABLE "xero_sync_logs" ADD COLUMN IF NOT EXISTS "entity_type" TEXT, ADD COLUMN IF NOT EXISTS "entity_id" TEXT,
  ADD COLUMN IF NOT EXISTS "xero_id" TEXT, ADD COLUMN IF NOT EXISTS "action" TEXT, ADD COLUMN IF NOT EXISTS "error" TEXT, ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "microsoft_sync_logs" ALTER COLUMN "direction" DROP DEFAULT;
ALTER TABLE "microsoft_sync_logs" ALTER COLUMN "direction" TYPE "MicrosoftSyncDirection" USING NULL;
ALTER TABLE "microsoft_sync_logs" ALTER COLUMN "organisation_id" DROP NOT NULL, ALTER COLUMN "sync_type" DROP NOT NULL;
ALTER TABLE "microsoft_sync_logs" ADD COLUMN IF NOT EXISTS "service" "MicrosoftService", ADD COLUMN IF NOT EXISTS "entity_type" TEXT,
  ADD COLUMN IF NOT EXISTS "entity_id" TEXT, ADD COLUMN IF NOT EXISTS "ms_id" TEXT, ADD COLUMN IF NOT EXISTS "action" TEXT,
  ADD COLUMN IF NOT EXISTS "error" TEXT, ADD COLUMN IF NOT EXISTS "metadata" JSONB;

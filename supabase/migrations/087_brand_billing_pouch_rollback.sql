-- 087_brand_billing_pouch_rollback.sql

ALTER TABLE public.brand_billing_invoices
  DROP CONSTRAINT IF EXISTS brand_billing_invoices_pouch_tier_check;

ALTER TABLE public.brand_billing_invoices
  DROP COLUMN IF EXISTS pouch_sent_qty,
  DROP COLUMN IF EXISTS pouch_sent_note,
  DROP COLUMN IF EXISTS pouch_tier;

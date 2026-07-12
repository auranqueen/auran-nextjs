-- 085_brand_order_billing_rollback.sql

DROP POLICY IF EXISTS supply_promos_read_authenticated ON public.supply_promos;

DROP POLICY IF EXISTS brand_billing_invoices_admin_all ON public.brand_billing_invoices;
DROP POLICY IF EXISTS brand_billing_invoices_brand_select ON public.brand_billing_invoices;
DROP POLICY IF EXISTS brand_billing_invoices_owner_select ON public.brand_billing_invoices;

DROP TABLE IF EXISTS public.brand_billing_invoices;

ALTER TABLE public.brand_payment_intents
  DROP CONSTRAINT IF EXISTS brand_payment_intents_kind_check;

DROP INDEX IF EXISTS idx_brand_payment_intents_invoice_id;

ALTER TABLE public.brand_payment_intents
  DROP COLUMN IF EXISTS invoice_id;

ALTER TABLE public.brand_payment_intents
  DROP COLUMN IF EXISTS kind;

DELETE FROM public.supply_promos
WHERE brand_id = '60413ded-91f4-4004-b677-ae684cb0677e'
  AND promo_type = 'qty_price'
  AND condition IN ('메디슈티컬', '프리미엄전문점', '전문점', '취급점');

ALTER TABLE public.brand_orders
  DROP COLUMN IF EXISTS total_amount;

-- 087_brand_billing_pouch.sql
-- brand_billing_invoices 파우치 증정 컬럼

ALTER TABLE public.brand_billing_invoices
  ADD COLUMN IF NOT EXISTS pouch_tier INTEGER,
  ADD COLUMN IF NOT EXISTS pouch_sent_qty INTEGER,
  ADD COLUMN IF NOT EXISTS pouch_sent_note TEXT;

ALTER TABLE public.brand_billing_invoices
  DROP CONSTRAINT IF EXISTS brand_billing_invoices_pouch_tier_check;

ALTER TABLE public.brand_billing_invoices
  ADD CONSTRAINT brand_billing_invoices_pouch_tier_check
  CHECK (pouch_tier IS NULL OR pouch_tier IN (200, 300, 500));

COMMENT ON COLUMN public.brand_billing_invoices.pouch_tier IS
  '월 합계금액 기준 자동: 200만→200, 300만→300, 500만→500. 미달 NULL';

COMMENT ON COLUMN public.brand_billing_invoices.pouch_sent_qty IS
  '브랜드 수기 기재 실제 파우치 발송 수량';

COMMENT ON COLUMN public.brand_billing_invoices.pouch_sent_note IS
  '파우치 발송 품목/메모 (브랜드 수기)';

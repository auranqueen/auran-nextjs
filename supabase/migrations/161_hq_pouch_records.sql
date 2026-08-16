-- Track B: monthly grade-pouch records (HQ stock / 오렌몰)
-- Separate table from brand_billing_invoices (Track A). Kits reuse pouch_tier_kits mechanism only.
CREATE TABLE IF NOT EXISTS public.hq_pouch_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.brand_companies(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  pouch_tier INTEGER CHECK (pouch_tier IS NULL OR pouch_tier IN (200, 300, 500)),
  pouch_status TEXT,
  pouch_kit_snapshot JSONB,
  pouch_tracking_no TEXT,
  pouch_courier TEXT,
  pouch_shipped_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (company_id, owner_id, billing_month),
  CONSTRAINT hq_pouch_records_pouch_status_check
    CHECK (pouch_status IS NULL OR pouch_status IN ('approved', 'shipped'))
);

COMMENT ON TABLE public.hq_pouch_records IS
  '트랙B(HQ/오렌몰) 월별 등급파우치. brand_billing_invoices와 분리. 집계 기준은 hq_stock_orders.final_amount.';

CREATE INDEX IF NOT EXISTS idx_hq_pouch_records_company_month
  ON public.hq_pouch_records(company_id, billing_month);

CREATE INDEX IF NOT EXISTS idx_hq_pouch_records_status
  ON public.hq_pouch_records(company_id, pouch_status);

ALTER TABLE public.hq_pouch_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hq_pouch_records_brand_access ON public.hq_pouch_records;
CREATE POLICY hq_pouch_records_brand_access ON public.hq_pouch_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = hq_pouch_records.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.company_id = hq_pouch_records.company_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

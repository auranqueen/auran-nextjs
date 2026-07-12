-- 085_brand_order_billing.sql
-- 브랜드 재고발주 청구 기반: brand_orders.total_amount, supply_promos 시드, brand_billing_invoices

-- ============================================================
-- 1. brand_orders.total_amount
-- ============================================================

ALTER TABLE public.brand_orders
  ADD COLUMN IF NOT EXISTS total_amount INTEGER DEFAULT 0;

COMMENT ON COLUMN public.brand_orders.total_amount IS
  '발주 시점 공급가 합계(원). items JSONB line_amount 합과 동기.';

-- ============================================================
-- 2. supply_promos — 시바산 등급별 수량 프로모 (기존 GRADE_PROMOS 이관)
-- ============================================================

DO $$
DECLARE
  v_brand_id UUID := '60413ded-91f4-4004-b677-ae684cb0677e';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.brands WHERE id = v_brand_id) THEN
    RAISE NOTICE '085: civasan brand row missing — supply_promos seed skipped';
    RETURN;
  END IF;

  DELETE FROM public.supply_promos
  WHERE brand_id = v_brand_id
    AND promo_type = 'qty_price'
    AND condition IN ('메디슈티컬', '프리미엄전문점', '전문점', '취급점');

  INSERT INTO public.supply_promos (
    brand_id, product_id, product_name, promo_type, title, condition, bonus, qty, bonus_qty, status
  ) VALUES
    (v_brand_id, NULL, NULL, 'qty_price', '메디슈티컬 10+10', '메디슈티컬', '10+10', 10, 10, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '메디슈티컬 10+5',  '메디슈티컬', '10+5',  10,  5, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '프리미엄전문점 10+5', '프리미엄전문점', '10+5', 10, 5, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '프리미엄전문점 10+4', '프리미엄전문점', '10+4', 10, 4, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '전문점 10+3', '전문점', '10+3', 10, 3, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '전문점 5+5',  '전문점', '5+5',   5, 5, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '취급점 10+1', '취급점', '10+1', 10, 1, 'active'),
    (v_brand_id, NULL, NULL, 'qty_price', '취급점 5+1',  '취급점', '5+1',   5, 1, 'active');
END $$;

-- ============================================================
-- 3. brand_billing_invoices
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_billing_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  billing_month DATE NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  points_total INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (status IN ('unpaid', 'paid')),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, owner_id, billing_month)
);

COMMENT ON TABLE public.brand_billing_invoices IS
  '원장별·브랜드별 월 청구서. 발주 누적 후 결제(2단계) 연동.';

CREATE INDEX IF NOT EXISTS idx_brand_billing_invoices_brand_month
  ON public.brand_billing_invoices(brand_id, billing_month DESC);

CREATE INDEX IF NOT EXISTS idx_brand_billing_invoices_owner
  ON public.brand_billing_invoices(owner_id, billing_month DESC);

-- ============================================================
-- 4. brand_payment_intents — tier | invoice
-- ============================================================

ALTER TABLE public.brand_payment_intents
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'tier';

ALTER TABLE public.brand_payment_intents
  DROP CONSTRAINT IF EXISTS brand_payment_intents_kind_check;

ALTER TABLE public.brand_payment_intents
  ADD CONSTRAINT brand_payment_intents_kind_check
  CHECK (kind IN ('tier', 'invoice'));

ALTER TABLE public.brand_payment_intents
  ADD COLUMN IF NOT EXISTS invoice_id UUID
  REFERENCES public.brand_billing_invoices(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brand_payment_intents_invoice_id
  ON public.brand_payment_intents(invoice_id)
  WHERE invoice_id IS NOT NULL;

COMMENT ON COLUMN public.brand_payment_intents.kind IS
  'tier=등급 셀프결제, invoice=월 청구서 결제';

COMMENT ON COLUMN public.brand_payment_intents.invoice_id IS
  'kind=invoice 일 때 brand_billing_invoices FK';

-- ============================================================
-- 5. RLS — brand_billing_invoices (079/084 패턴)
-- INSERT/UPDATE는 API service role 전용 (정책 없음)
-- ============================================================

ALTER TABLE public.brand_billing_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_billing_invoices_owner_select ON public.brand_billing_invoices;
CREATE POLICY brand_billing_invoices_owner_select ON public.brand_billing_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_billing_invoices.owner_id
    )
  );

DROP POLICY IF EXISTS brand_billing_invoices_brand_select ON public.brand_billing_invoices;
CREATE POLICY brand_billing_invoices_brand_select ON public.brand_billing_invoices
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_billing_invoices.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS brand_billing_invoices_admin_all ON public.brand_billing_invoices;
CREATE POLICY brand_billing_invoices_admin_all ON public.brand_billing_invoices
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- supply_promos: 원장·브랜드 발주 화면 SELECT (기존 RLS 없을 때 대비)
ALTER TABLE public.supply_promos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS supply_promos_read_authenticated ON public.supply_promos;
CREATE POLICY supply_promos_read_authenticated ON public.supply_promos
  FOR SELECT
  TO authenticated
  USING (true);

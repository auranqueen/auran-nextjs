-- 120_hq_stock_orders_rls.sql
-- 트랙B 원장 → 오렌 본사(브랜드) 재고발주 주문
-- brand_product_orders용 RLS 마이그레이션 원문이 레포에 없어,
-- brand_billing_invoices(085) 소유자/브랜드 SELECT + admin ALL 패턴을 동일 적용.
-- INSERT는 원장 본인 profile_id만 허용. 결제 상태 갱신은 service role(API/웹훅).

CREATE TABLE IF NOT EXISTS public.hq_stock_orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id      UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  profile_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT '결제대기'
    CHECK (status IN ('결제대기', '결제완료', '배송완료', '구매확정', '취소')),
  items         JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal      INTEGER NOT NULL DEFAULT 0,
  final_amount  INTEGER NOT NULL DEFAULT 0,
  owner_name    TEXT,
  salon_name    TEXT,
  payment_id    TEXT,
  ordered_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.hq_stock_orders IS
  '트랙B 원장 본사 재고발주. brand_orders(트랙A)·brand_product_orders(살롱스토어)와 물리 분리.';

CREATE INDEX IF NOT EXISTS idx_hq_stock_orders_profile_id
  ON public.hq_stock_orders(profile_id);

CREATE INDEX IF NOT EXISTS idx_hq_stock_orders_brand_id
  ON public.hq_stock_orders(brand_id);

CREATE INDEX IF NOT EXISTS idx_hq_stock_orders_brand_ordered
  ON public.hq_stock_orders(brand_id, ordered_at DESC);

ALTER TABLE public.hq_stock_orders ENABLE ROW LEVEL SECURITY;

-- 원장: 본인 profile 주문만 SELECT
DROP POLICY IF EXISTS hq_stock_orders_owner_select ON public.hq_stock_orders;
CREATE POLICY hq_stock_orders_owner_select ON public.hq_stock_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = hq_stock_orders.profile_id
    )
  );

-- 원장: 본인 profile로 INSERT
DROP POLICY IF EXISTS hq_stock_orders_owner_insert ON public.hq_stock_orders;
CREATE POLICY hq_stock_orders_owner_insert ON public.hq_stock_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = hq_stock_orders.profile_id
    )
  );

-- 브랜드: 자기 브랜드 주문 SELECT (대시보드 KPI)
DROP POLICY IF EXISTS hq_stock_orders_brand_select ON public.hq_stock_orders;
CREATE POLICY hq_stock_orders_brand_select ON public.hq_stock_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = hq_stock_orders.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

-- 어드민 전체
DROP POLICY IF EXISTS hq_stock_orders_admin_all ON public.hq_stock_orders;
CREATE POLICY hq_stock_orders_admin_all ON public.hq_stock_orders
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

-- 트랙B 원장이 발주 카탈로그(brand_products active) 조회 가능하도록
-- (091은 트랙A owner만 SELECT — B 발주 화면 필수)
DROP POLICY IF EXISTS brand_products_select_active_owner_b ON public.brand_products;
CREATE POLICY brand_products_select_active_owner_b ON public.brand_products
  FOR SELECT
  USING (
    status = 'active'
    AND EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role = 'owner'
        AND u.origin_track = 'B'
    )
  );

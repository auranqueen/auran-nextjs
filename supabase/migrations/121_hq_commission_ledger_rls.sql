-- 121_hq_commission_ledger_rls.sql
-- 트랙B HQ 재고발주 스폰서 커미션 원장
-- RLS: hq_stock_orders_admin_all 패턴 (users.role=admin FOR ALL)

CREATE TABLE IF NOT EXISTS public.hq_commission_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type       TEXT NOT NULL DEFAULT 'hq_stock_order'
    CHECK (source_type IN ('hq_stock_order')),
  source_order_id   UUID NOT NULL REFERENCES public.hq_stock_orders(id) ON DELETE CASCADE,
  brand_id          UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  buyer_owner_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sponsor_owner_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  commission_rate   NUMERIC(5, 2) NOT NULL,
  commission_amount INTEGER NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_type, source_order_id)
);

COMMENT ON TABLE public.hq_commission_ledger IS
  '트랙B HQ 재고발주 스폰서 커미션. sponsor_commission_ledger(등급구매)와 물리 분리.';

CREATE INDEX IF NOT EXISTS idx_hq_commission_ledger_sponsor
  ON public.hq_commission_ledger(sponsor_owner_id);

CREATE INDEX IF NOT EXISTS idx_hq_commission_ledger_brand
  ON public.hq_commission_ledger(brand_id);

CREATE INDEX IF NOT EXISTS idx_hq_commission_ledger_status
  ON public.hq_commission_ledger(status);

CREATE INDEX IF NOT EXISTS idx_hq_commission_ledger_created
  ON public.hq_commission_ledger(created_at DESC);

ALTER TABLE public.hq_commission_ledger ENABLE ROW LEVEL SECURITY;

-- 스폰서: 본인 건 SELECT
DROP POLICY IF EXISTS hq_commission_ledger_sponsor_select ON public.hq_commission_ledger;
CREATE POLICY hq_commission_ledger_sponsor_select ON public.hq_commission_ledger
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND (
          p.id = hq_commission_ledger.sponsor_owner_id
          OR p.id = hq_commission_ledger.buyer_owner_id
        )
    )
  );

-- 어드민 전체 (hq_stock_orders_admin_all 동일 패턴)
DROP POLICY IF EXISTS hq_commission_ledger_admin_all ON public.hq_commission_ledger;
CREATE POLICY hq_commission_ledger_admin_all ON public.hq_commission_ledger
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

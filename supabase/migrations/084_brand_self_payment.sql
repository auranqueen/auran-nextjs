-- 084_brand_self_payment.sql
-- 트랙A 브랜드 자체 등급 셀프결제 (brand_payment_intents)
-- brands.payapp_key = PayApp linkkey, payapp_linkval = PayApp linkval

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS payapp_linkval TEXT;

COMMENT ON COLUMN public.brands.payapp_key IS
  'PayApp 연동 linkkey (결제요청·웹훅 검증). payapp_linkval과 쌍으로 사용.';

COMMENT ON COLUMN public.brands.payapp_linkval IS
  'PayApp 연동 linkval (결제요청·웹훅 검증). payapp_key와 쌍으로 사용.';

-- ============================================================
-- brand_payment_intents
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brand_payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tier_package_id UUID REFERENCES public.brand_tier_packages(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'failed', 'cancelled')),
  provider_trade_id TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.brand_payment_intents IS
  '브랜드 자체 PayApp 등급 결제 의향. payment_intents와 완전 분리.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_brand_payment_intents_brand_trade
  ON public.brand_payment_intents(brand_id, provider_trade_id)
  WHERE provider_trade_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_brand_payment_intents_owner
  ON public.brand_payment_intents(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_payment_intents_brand_status
  ON public.brand_payment_intents(brand_id, status);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS brand_payment_intents_updated_at ON public.brand_payment_intents;
    CREATE TRIGGER brand_payment_intents_updated_at
    BEFORE UPDATE ON public.brand_payment_intents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- RLS (079 패턴: owner SELECT + brand SELECT + admin ALL)
-- INSERT/UPDATE는 API service role 전용 (정책 없음)
-- ============================================================

ALTER TABLE public.brand_payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS brand_payment_intents_owner_select ON public.brand_payment_intents;
CREATE POLICY brand_payment_intents_owner_select ON public.brand_payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.auth_id = auth.uid()
        AND p.id = brand_payment_intents.owner_id
    )
  );

DROP POLICY IF EXISTS brand_payment_intents_brand_select ON public.brand_payment_intents;
CREATE POLICY brand_payment_intents_brand_select ON public.brand_payment_intents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_payment_intents.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS brand_payment_intents_admin_all ON public.brand_payment_intents;
CREATE POLICY brand_payment_intents_admin_all ON public.brand_payment_intents
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

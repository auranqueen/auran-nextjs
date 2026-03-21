-- 캠페인별 쿠폰 발급 이력 (어드민)
CREATE TABLE IF NOT EXISTS public.coupon_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID REFERENCES public.coupons(id) ON DELETE SET NULL,
  campaign_name TEXT,
  target_count INT DEFAULT 0,
  success_count INT DEFAULT 0,
  duplicate_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  results JSONB DEFAULT '[]'::jsonb,
  issued_by TEXT DEFAULT 'admin',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coupon_campaigns_issued_at ON public.coupon_campaigns(issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_coupon_campaigns_coupon_id ON public.coupon_campaigns(coupon_id);

COMMENT ON TABLE public.coupon_campaigns IS '어드민 쿠폰 일괄/타겟 발급 캠페인 이력';

ALTER TABLE public.coupon_campaigns ENABLE ROW LEVEL SECURITY;
-- 클라이언트는 API 경유만; Supabase service_role은 RLS 우회

-- 고객 등급: 인플루언서 (UI 5단계 중 1개)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_customer_grade_chk;
ALTER TABLE public.users
  ADD CONSTRAINT users_customer_grade_chk
  CHECK (customer_grade IN ('welcome', 'silver', 'gold', 'vip', 'influencer'));

COMMENT ON COLUMN public.users.customer_grade IS '고객 등급: welcome | silver | gold | vip | influencer';

-- 구매 상위 N명 (어드민 전용, 서비스 롤에서만 호출)
CREATE OR REPLACE FUNCTION public.admin_top_customers_by_spend(limit_n int)
RETURNS TABLE (customer_id uuid, total_spend bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.customer_id, SUM(o.final_amount)::bigint AS total_spend
  FROM public.orders o
  WHERE o.customer_id IS NOT NULL
    AND o.status NOT IN ('취소'::order_status, '환불'::order_status)
  GROUP BY o.customer_id
  ORDER BY total_spend DESC
  LIMIT GREATEST(1, LEAST(limit_n, 500));
$$;

COMMENT ON FUNCTION public.admin_top_customers_by_spend IS '어드민: 누적 구매액 상위 고객 (customer_id = public.users.id)';

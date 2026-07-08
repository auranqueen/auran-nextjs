CREATE TABLE IF NOT EXISTS public.scheduled_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_type text NOT NULL DEFAULT 'owner' CHECK (sender_type IN ('owner', 'brand')),
  sender_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('manual_list', 'product_repurchase')),
  target_customer_ids uuid[],
  target_product_id uuid REFERENCES public.products(id),
  target_date_from timestamptz,
  target_date_to timestamptz,
  message text NOT NULL,
  sender_display_name text,
  reward_type text NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'gift_product', 'gift_product_and_discount', 'none')),
  gift_product_id uuid REFERENCES public.products(id),
  gift_product_qty integer,
  coupon_id uuid REFERENCES public.coupons(id),
  scheduled_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'cancelled')),
  created_by uuid NOT NULL,
  sent_at timestamptz,
  result_success_count integer,
  result_failed_count integer,
  result_no_channel_count integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.scheduled_campaigns IS '예약형 마케팅 캠페인 - 지정 시각에 대상 고객에게 메시지+증정 발송';
COMMENT ON COLUMN public.scheduled_campaigns.sender_type IS '발신 주체: owner(원장→고객) / brand(브랜드→원장, 추후 확장)';
COMMENT ON COLUMN public.scheduled_campaigns.sender_id IS 'sender_type이 owner면 owner_id, brand면 brand_id';
COMMENT ON COLUMN public.scheduled_campaigns.target_type IS 'manual_list(체크박스로 고른 고객 리스트) / product_repurchase(제품+기간 필터)';
COMMENT ON COLUMN public.scheduled_campaigns.sender_display_name IS '카드 타이틀용 스토어명 스냅샷 (예: "OO원장님이 미쳤나봐요")';
COMMENT ON COLUMN public.scheduled_campaigns.status IS 'pending=대기중(취소가능) / sent=발송완료(취소불가) / failed=실패 / cancelled=취소됨';
ALTER TABLE public.scheduled_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY scheduled_campaigns_admin_all ON public.scheduled_campaigns
  FOR ALL
  USING (
    auth.jwt() -> 'app_metadata' ->> 'role' = 'super_admin'
    OR EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

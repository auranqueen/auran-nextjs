ALTER TABLE public.coupons
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'discount' CHECK (reward_type IN ('discount', 'gift_product', 'gift_product_and_discount')),
  ADD COLUMN IF NOT EXISTS gift_product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS gift_product_qty integer,
  ADD COLUMN IF NOT EXISTS campaign_quantity_limit integer,
  ADD COLUMN IF NOT EXISTS campaign_quantity_issued integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.coupons.reward_type IS '쿠폰 보상 종류: discount(할인만) / gift_product(제품증정만) / gift_product_and_discount(증정+할인)';
COMMENT ON COLUMN public.coupons.gift_product_id IS '증정 대상 제품 (reward_type이 gift 계열일 때만 사용)';
COMMENT ON COLUMN public.coupons.gift_product_qty IS '1인당 증정 수량';
COMMENT ON COLUMN public.coupons.campaign_quantity_limit IS '캠페인 전체 증정 한도 (타겟 리스트 인원수 기준, null이면 무제한)';
COMMENT ON COLUMN public.coupons.campaign_quantity_issued IS '캠페인 누적 지급 건수, limit 도달 시 추가 발급 차단 용도';

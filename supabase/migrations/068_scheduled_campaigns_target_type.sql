ALTER TABLE public.scheduled_campaigns
  ADD COLUMN IF NOT EXISTS target_customer_type text NOT NULL DEFAULT 'external_customer' CHECK (target_customer_type IN ('external_customer', 'auran_user'));
COMMENT ON COLUMN public.scheduled_campaigns.target_customer_type IS 'target_customer_ids가 가리키는 대상 테이블 구분: external_customer(외부고객카드) / auran_user(오렌 가입 내부고객, profiles/users 기준)';

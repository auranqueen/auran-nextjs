-- 고객 멤버십 등급 (쿠폰 특정등급 발급 대상 등)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS customer_grade text NOT NULL DEFAULT 'welcome';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_customer_grade_chk'
  ) THEN
    ALTER TABLE public.users
      ADD CONSTRAINT users_customer_grade_chk
      CHECK (customer_grade IN ('welcome', 'silver', 'gold', 'vip'));
  END IF;
END $$;

COMMENT ON COLUMN public.users.customer_grade IS '고객 등급: welcome | silver | gold | vip';

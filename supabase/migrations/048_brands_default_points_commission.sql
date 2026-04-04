-- 브랜드별 제품 기본값(포인트·수수료 메타) 저장
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS default_earn_points integer,
  ADD COLUMN IF NOT EXISTS default_earn_points_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS default_share_points integer,
  ADD COLUMN IF NOT EXISTS default_share_points_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS default_review_text integer,
  ADD COLUMN IF NOT EXISTS default_review_photo integer,
  ADD COLUMN IF NOT EXISTS default_review_video integer,
  ADD COLUMN IF NOT EXISTS default_partner_commission numeric,
  ADD COLUMN IF NOT EXISTS default_partner_commission_type text DEFAULT 'percent',
  ADD COLUMN IF NOT EXISTS default_owner_commission numeric,
  ADD COLUMN IF NOT EXISTS default_owner_commission_type text DEFAULT 'percent';

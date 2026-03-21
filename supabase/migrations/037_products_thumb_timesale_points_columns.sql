-- 추가 상품 컬럼 (기존 007/012/036과 병행; 이미 있으면 스킵)
-- earn_points_percent: NUMERIC % (기존 earn_points 정수 컬럼과 별개)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS thumb_images TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS video_url TEXT,
  ADD COLUMN IF NOT EXISTS detail_images TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS detail_content TEXT,
  ADD COLUMN IF NOT EXISTS earn_points_percent NUMERIC DEFAULT 1,
  ADD COLUMN IF NOT EXISTS share_points INT DEFAULT 50,
  ADD COLUMN IF NOT EXISTS review_points_text INT DEFAULT 100,
  ADD COLUMN IF NOT EXISTS review_points_photo INT DEFAULT 300,
  ADD COLUMN IF NOT EXISTS review_points_video INT DEFAULT 500,
  ADD COLUMN IF NOT EXISTS is_timesale BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC,
  ADD COLUMN IF NOT EXISTS timesale_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS timesale_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN public.products.earn_points_percent IS '구매 적립 비율 (%) — 소수 허용';
COMMENT ON COLUMN public.products.thumb_images IS '썸네일 이미지 URL 배열';

-- 리뷰 수정 추적
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

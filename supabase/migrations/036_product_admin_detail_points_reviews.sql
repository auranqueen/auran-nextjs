-- 제품 상세 에디터·포인트 설정·리뷰 적립
-- products.earn_points = 구매 적립 비율 (%), 정수 (예: 1 = 1%)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS detail_content TEXT,
  ADD COLUMN IF NOT EXISTS detail_images TEXT[],
  ADD COLUMN IF NOT EXISTS earn_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_points INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_points_text INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_points_photo INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_points_video INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS storage_thumb_url TEXT;

COMMENT ON COLUMN public.products.earn_points IS '구매 적립: 결제 금액 대비 % (정수)';

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS video_url TEXT;

-- 리뷰 게시 시 상품별 포인트 지급 (텍스트 / 포토 / 영상 우선순위: 영상 > 포토 > 텍스트)
CREATE OR REPLACE FUNCTION public.award_product_review_points()
RETURNS TRIGGER AS $$
DECLARE
  pts INT;
  v_video INT;
  v_photo INT;
  v_text INT;
BEGIN
  IF NEW.review_type IS DISTINCT FROM 'product' OR NEW.status IS DISTINCT FROM '게시' THEN
    RETURN NEW;
  END IF;
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(review_points_video, 0),
    COALESCE(review_points_photo, 0),
    COALESCE(review_points_text, 0)
  INTO v_video, v_photo, v_text
  FROM public.products
  WHERE id = NEW.target_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NEW.video_url IS NOT NULL AND LENGTH(TRIM(NEW.video_url)) > 0 THEN
    pts := v_video;
  ELSIF NEW.images IS NOT NULL AND array_length(NEW.images, 1) IS NOT NULL AND array_length(NEW.images, 1) > 0 THEN
    pts := v_photo;
  ELSE
    pts := v_text;
  END IF;

  IF pts > 0 THEN
    PERFORM public.award_points(NEW.author_id, pts, '리뷰 작성 적립', '⭐', NULL);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_award_product_review_points ON public.reviews;
CREATE TRIGGER trg_award_product_review_points
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.award_product_review_points();

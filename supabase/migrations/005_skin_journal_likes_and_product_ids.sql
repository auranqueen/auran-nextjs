-- ============================================================
-- 5. 스킨저널 제품 연결 + 공감(좋아요) 기능
-- ============================================================

-- skin_journals: 사용 제품 연결
ALTER TABLE public.skin_journals
  ADD COLUMN IF NOT EXISTS product_ids UUID[] DEFAULT '{}';

-- 스킨저널 공감(좋아요)
CREATE TABLE IF NOT EXISTS public.skin_journal_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_id UUID REFERENCES public.skin_journals(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(journal_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_skin_journal_likes_journal ON public.skin_journal_likes(journal_id);
CREATE INDEX IF NOT EXISTS idx_skin_journal_likes_user ON public.skin_journal_likes(user_id);

-- 제품 후기 공감(좋아요)
CREATE TABLE IF NOT EXISTS public.product_review_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(review_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_review_likes_review ON public.product_review_likes(review_id);
CREATE INDEX IF NOT EXISTS idx_product_review_likes_user ON public.product_review_likes(user_id);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.skin_journal_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_review_likes ENABLE ROW LEVEL SECURITY;

-- 공개: 카운트 조회 등(SELECT) 허용
DROP POLICY IF EXISTS "skin_journal_likes_public_read" ON public.skin_journal_likes;
CREATE POLICY "skin_journal_likes_public_read" ON public.skin_journal_likes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "product_review_likes_public_read" ON public.product_review_likes;
CREATE POLICY "product_review_likes_public_read" ON public.product_review_likes
  FOR SELECT USING (true);

-- 작성자 본인만 좋아요/취소(INSERT/DELETE) 허용
DROP POLICY IF EXISTS "skin_journal_likes_owner_write" ON public.skin_journal_likes;
CREATE POLICY "skin_journal_likes_owner_write" ON public.skin_journal_likes
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

DROP POLICY IF EXISTS "product_review_likes_owner_write" ON public.product_review_likes;
CREATE POLICY "product_review_likes_owner_write" ON public.product_review_likes
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  )
  WITH CHECK (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );


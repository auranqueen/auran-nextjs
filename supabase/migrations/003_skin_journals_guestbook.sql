-- ============================================================
-- 3. 스킨저널 & 방명록
-- ============================================================

-- 스킨저널: 날짜별 피부 상태 기록
CREATE TABLE IF NOT EXISTS public.skin_journals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  photo_url TEXT,
  memo TEXT,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_skin_journals_user_date ON public.skin_journals(user_id, date DESC);

-- 방명록: 프로필 소유자에게 남기는 메시지
CREATE TABLE IF NOT EXISTS public.guestbook (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  writer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  writer_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guestbook_owner_created ON public.guestbook(owner_id, created_at DESC);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.skin_journals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guestbook ENABLE ROW LEVEL SECURITY;

-- 스킨저널: 읽기(공개) + 작성/수정(본인)
DROP POLICY IF EXISTS "skin_journals_public_read" ON public.skin_journals;
DROP POLICY IF EXISTS "skin_journals_owner_write" ON public.skin_journals;

CREATE POLICY "skin_journals_public_read" ON public.skin_journals
  FOR SELECT
  USING (true);

CREATE POLICY "skin_journals_owner_write" ON public.skin_journals
  FOR ALL
  USING (
    user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- 방명록: 읽기(공개) + 작성(본인)
DROP POLICY IF EXISTS "guestbook_public_read" ON public.guestbook;
DROP POLICY IF EXISTS "guestbook_writer_insert" ON public.guestbook;

CREATE POLICY "guestbook_public_read" ON public.guestbook
  FOR SELECT
  USING (true);

CREATE POLICY "guestbook_writer_insert" ON public.guestbook
  FOR INSERT
  WITH CHECK (
    writer_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );


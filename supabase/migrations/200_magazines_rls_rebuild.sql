-- 200_magazines_rls_rebuild.sql
-- 이 마이그레이션은 이미 운영 DB에 SQL Editor로 직접 실행되어 반영된 상태를
-- 레포에 기록하기 위한 것임. 재실행해도 안전하도록 DROP IF EXISTS + CREATE 순서.
-- 실행 불필요. (197/198/199와 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- C2: roles:public 무조건 열린 삭제/생성/수정 제거. SELECT("magazines 읽기")는 유지.
-- 신규: magazines_admin_write ALL(users.role=admin 또는 JWT super_admin).
-- increment_magazine_view_count: 발행된 글만 view_count + 1 (SECURITY DEFINER).
-- 앱 코드는 아직 클라이언트 UPDATE. RPC 전환은 후속. storage.objects는 범위 밖.

CREATE OR REPLACE FUNCTION public.increment_magazine_view_count(p_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.magazines
  SET view_count = COALESCE(view_count, 0) + 1
  WHERE id = p_id
    AND is_published = true
    AND published_at IS NOT NULL
    AND published_at <= now()
  RETURNING view_count INTO v_count;
  RETURN COALESCE(v_count, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.increment_magazine_view_count(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_magazine_view_count(uuid) TO anon, authenticated;
DROP POLICY IF EXISTS "magazines 삭제" ON public.magazines;
DROP POLICY IF EXISTS "magazines 생성" ON public.magazines;
DROP POLICY IF EXISTS "magazines 수정" ON public.magazines;
DROP POLICY IF EXISTS magazines_admin_write ON public.magazines;
CREATE POLICY magazines_admin_write
  ON public.magazines
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid() AND u.role = 'admin'
    )
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
  );

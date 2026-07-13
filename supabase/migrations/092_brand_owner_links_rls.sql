-- 092_brand_owner_links_rls.sql
-- brand_owner_links RLS: owner 본인 SELECT / brand 소유·멤버 SELECT·UPDATE / admin ALL
-- service role INSERT·백필은 RLS 우회 (기존 owner-signup-v2·connect-owners와 동일)

ALTER TABLE public.brand_owner_links ENABLE ROW LEVEL SECURITY;

-- owner: 본인 연결만 조회 (owner_id = users.id)
DROP POLICY IF EXISTS brand_owner_links_owner_select ON public.brand_owner_links;
CREATE POLICY brand_owner_links_owner_select ON public.brand_owner_links
  FOR SELECT
  USING (
    owner_id = public.current_user_id()
    OR owner_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
  );

-- brand: 소유 브랜드 또는 brand_members 소속 → SELECT + UPDATE(승인 등)
DROP POLICY IF EXISTS brand_owner_links_brand_select ON public.brand_owner_links;
CREATE POLICY brand_owner_links_brand_select ON public.brand_owner_links
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_owner_links.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_owner_links.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

DROP POLICY IF EXISTS brand_owner_links_brand_update ON public.brand_owner_links;
CREATE POLICY brand_owner_links_brand_update ON public.brand_owner_links
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_owner_links.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_owner_links.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.brands b
      WHERE b.id = brand_owner_links.brand_id
        AND (b.user_id = public.current_user_id() OR b.user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.brand_members bm
      WHERE bm.brand_id = brand_owner_links.brand_id
        AND (
          bm.user_id = public.current_user_id()
          OR bm.user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())
        )
    )
  );

-- admin: 전체
DROP POLICY IF EXISTS brand_owner_links_admin_all ON public.brand_owner_links;
CREATE POLICY brand_owner_links_admin_all ON public.brand_owner_links
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

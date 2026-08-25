-- 169_oren_scene_posts_rls_content_type.sql
-- content_type 3분류 INSERT RLS. 실행은 운영에서 별도 적용.
--
-- 기존 insert_customer (166): uploader_type=customer AND uploader_user_id=current_user_id()
--   → salon_id 조건 없음. verified(salon 있음)/free(salon 없음) 모두 통과 가능.
-- 기존 insert_owner: salon_id IN (소유 살롱) → content_type=owner 와 정합.
--
-- 정책을 content_type과 명시적으로 맞춤 (동일 효과 + 문서화).

DROP POLICY IF EXISTS oren_scene_posts_insert_customer ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_insert_customer ON public.oren_scene_posts
  FOR INSERT
  WITH CHECK (
    uploader_type = 'customer'
    AND uploader_user_id = public.current_user_id()
    AND content_type IN ('verified', 'free')
  );

DROP POLICY IF EXISTS oren_scene_posts_insert_owner ON public.oren_scene_posts;
CREATE POLICY oren_scene_posts_insert_owner ON public.oren_scene_posts
  FOR INSERT
  WITH CHECK (
    uploader_type = 'owner'
    AND content_type = 'owner'
    AND uploader_user_id = public.current_user_id()
    AND salon_id IN (
      SELECT salons.id
      FROM public.salons
      WHERE salons.owner_id = public.current_user_id()
    )
  );

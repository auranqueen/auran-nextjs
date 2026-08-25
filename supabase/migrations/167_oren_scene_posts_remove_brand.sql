-- 167_oren_scene_posts_remove_brand.sql
-- Record + apply doc: 오렌씬은 원장/고객 전용. 브랜드 업로더 제거 (플렉스라운지로 분리).
-- Note: uploader_type CHECK 재작성 전에 brand 행 DELETE 필수 (순서 주의).

-- 1) 기존 업로더 일관성 CHECK 제거
ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS chk_uploader_consistency;

-- 2) uploader_type CHECK 제거 (재작성 전)
ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS oren_scene_posts_uploader_type_check;

-- 3) brand 업로더 행 삭제
DELETE FROM public.oren_scene_posts
WHERE uploader_type = 'brand';

-- 4) uploader_type: owner / customer 만 허용
ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT oren_scene_posts_uploader_type_check
  CHECK (uploader_type IN ('owner', 'customer'));

-- 5) brand_staff FK 제거 후 컬럼 DROP
ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS oren_scene_posts_uploader_brand_staff_id_fkey;

ALTER TABLE public.oren_scene_posts
  DROP COLUMN IF EXISTS uploader_brand_staff_id;

-- 6) 새 업로더 일관성 CHECK (owner/customer + uploader_user_id 필수)
ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_uploader_consistency
  CHECK (
    uploader_type IN ('owner', 'customer')
    AND uploader_user_id IS NOT NULL
  );

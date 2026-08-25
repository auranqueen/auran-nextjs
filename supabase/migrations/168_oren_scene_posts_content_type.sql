-- 168_oren_scene_posts_content_type.sql
-- content_type: verified | free | owner. 실행은 운영에서 별도 적용.
-- verified 증거: booking_id XOR order_item_id(트랙A brand_product_order_items).
-- CTA: booking → link_type='booking' / order_item → link_type='brand_product'
--
-- chk_uploader_consistency (167): uploader_user_id 필수, salon 조건 없음 → 유지.

-- 1) salon_id nullable
ALTER TABLE public.oren_scene_posts
  ALTER COLUMN salon_id DROP NOT NULL;

-- 2) content_type
ALTER TABLE public.oren_scene_posts
  ADD COLUMN IF NOT EXISTS content_type TEXT NOT NULL DEFAULT 'verified';

ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS oren_scene_posts_content_type_check;

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT oren_scene_posts_content_type_check
  CHECK (content_type IN ('verified', 'free', 'owner'));

-- 3) order_item_id (트랙A 제품구매 증거) — 이전 draft의 purchase_id(관리권) 제거
DROP INDEX IF EXISTS idx_oren_scene_posts_purchase_id;
ALTER TABLE public.oren_scene_posts
  DROP COLUMN IF EXISTS purchase_id;

ALTER TABLE public.oren_scene_posts
  ADD COLUMN IF NOT EXISTS order_item_id UUID
    REFERENCES public.brand_product_order_items(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_oren_scene_posts_order_item_id
  ON public.oren_scene_posts (order_item_id)
  WHERE order_item_id IS NOT NULL;

-- 4) drop legacy / prior constraints
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_verified_requires_salon_booking;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_free_no_booking;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_free_link_type;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_verified;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_free;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_owner;
ALTER TABLE public.oren_scene_posts DROP CONSTRAINT IF EXISTS chk_owner_link_type;

-- 5) content_type rules
-- verified: salon 필수 + (booking XOR order_item) + customer
-- CTA 규칙:
--   booking_id → link_type='booking'
--   order_item_id → link_type='brand_product' (item.brand_product_id 자동 복사)
ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_verified CHECK (
    content_type <> 'verified'
    OR (
      salon_id IS NOT NULL
      AND uploader_type = 'customer'
      AND (
        (booking_id IS NOT NULL AND order_item_id IS NULL)
        OR (booking_id IS NULL AND order_item_id IS NOT NULL)
      )
    )
  );

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_free CHECK (
    content_type <> 'free'
    OR (
      booking_id IS NULL
      AND order_item_id IS NULL
      AND uploader_type = 'customer'
      AND link_type IN ('product', 'none')
    )
  );

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_owner CHECK (
    content_type <> 'owner'
    OR (
      booking_id IS NULL
      AND order_item_id IS NULL
      AND uploader_type = 'owner'
      AND salon_id IS NOT NULL
    )
  );

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_owner_link_type CHECK (
    content_type <> 'owner'
    OR link_type IN ('product', 'brand_product', 'none')
  );

-- 6) link_type consistency
ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS chk_link_type_consistency;

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_link_type_consistency CHECK (
    (
      link_type = 'booking'
      AND booking_id IS NOT NULL
      AND order_item_id IS NULL
      AND brand_product_id IS NULL
      AND product_id IS NULL
      AND content_type = 'verified'
    )
    OR (
      link_type = 'brand_product'
      AND brand_product_id IS NOT NULL
      AND product_id IS NULL
      AND (
        (content_type = 'verified' AND order_item_id IS NOT NULL AND booking_id IS NULL)
        OR (content_type = 'owner' AND order_item_id IS NULL AND booking_id IS NULL)
      )
    )
    OR (
      link_type = 'product'
      AND product_id IS NOT NULL
      AND brand_product_id IS NULL
      AND order_item_id IS NULL
      AND booking_id IS NULL
      AND content_type IN ('free', 'owner')
    )
    OR (
      link_type = 'none'
      AND brand_product_id IS NULL
      AND product_id IS NULL
      AND booking_id IS NULL
      AND order_item_id IS NULL
      AND content_type IN ('free', 'owner')
    )
  );

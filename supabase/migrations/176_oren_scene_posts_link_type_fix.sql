-- 176_oren_scene_posts_link_type_fix.sql
-- Align link_type CHECKs with design:
--   owner: booking | brand_product | none (no oren-mall product)
--   free:  brand_product | product | none
--   booking CTA: verified (with booking_id) OR owner salon-level (booking_id NULL)
-- Apply separately in ops. Do not re-run 168.

ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS chk_owner_link_type;

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_owner_link_type CHECK (
    content_type <> 'owner'
    OR link_type IN ('booking', 'brand_product', 'none')
  );

ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS chk_free;

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_free CHECK (
    content_type <> 'free'
    OR (
      booking_id IS NULL
      AND order_item_id IS NULL
      AND uploader_type = 'customer'
      AND link_type IN ('brand_product', 'product', 'none')
    )
  );

ALTER TABLE public.oren_scene_posts
  DROP CONSTRAINT IF EXISTS chk_link_type_consistency;

ALTER TABLE public.oren_scene_posts
  ADD CONSTRAINT chk_link_type_consistency CHECK (
    (
      link_type = 'booking'
      AND order_item_id IS NULL
      AND brand_product_id IS NULL
      AND product_id IS NULL
      AND (
        (content_type = 'verified' AND booking_id IS NOT NULL)
        OR (content_type = 'owner' AND booking_id IS NULL AND salon_id IS NOT NULL)
      )
    )
    OR (
      link_type = 'brand_product'
      AND brand_product_id IS NOT NULL
      AND product_id IS NULL
      AND (
        (content_type = 'verified' AND order_item_id IS NOT NULL AND booking_id IS NULL)
        OR (content_type = 'owner' AND order_item_id IS NULL AND booking_id IS NULL)
        OR (content_type = 'free' AND order_item_id IS NULL AND booking_id IS NULL)
      )
    )
    OR (
      link_type = 'product'
      AND product_id IS NOT NULL
      AND brand_product_id IS NULL
      AND order_item_id IS NULL
      AND booking_id IS NULL
      AND content_type = 'free'
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

-- 171_brand_product_orders_source_scene_post.sql
-- Track A brand_product_orders <- oren scene referral. Apply separately in ops.
-- 170 added bookings/purchases only; this adds brand_product_orders.

ALTER TABLE public.brand_product_orders
  ADD COLUMN IF NOT EXISTS source_scene_post_id UUID
    REFERENCES public.oren_scene_posts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_brand_product_orders_source_scene_post_id
  ON public.brand_product_orders (source_scene_post_id)
  WHERE source_scene_post_id IS NOT NULL;

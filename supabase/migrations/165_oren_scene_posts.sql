-- 165_oren_scene_posts.sql
-- DB already applied (SQL Editor). Record-only migration — do not re-run as fresh apply without IF NOT EXISTS awareness.

CREATE TABLE IF NOT EXISTS public.oren_scene_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  salon_id UUID NOT NULL,
  uploader_type TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT NULL,
  duration_seconds INTEGER NULL,
  highlight_tag TEXT NULL,
  link_type TEXT NOT NULL DEFAULT 'none',
  booking_id UUID NULL,
  brand_product_id UUID NULL,
  product_id UUID NULL,
  view_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  booking_conversion_count INTEGER NOT NULL DEFAULT 0,
  revenue_generated NUMERIC NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploader_user_id UUID NULL,
  uploader_brand_staff_id UUID NULL,
  CONSTRAINT oren_scene_posts_pkey PRIMARY KEY (id),
  CONSTRAINT oren_scene_posts_booking_id_fkey
    FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON DELETE SET NULL,
  CONSTRAINT oren_scene_posts_brand_product_id_fkey
    FOREIGN KEY (brand_product_id) REFERENCES public.brand_products(id) ON DELETE SET NULL,
  CONSTRAINT oren_scene_posts_product_id_fkey
    FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL,
  CONSTRAINT oren_scene_posts_salon_id_fkey
    FOREIGN KEY (salon_id) REFERENCES public.salons(id) ON DELETE CASCADE,
  CONSTRAINT oren_scene_posts_uploader_brand_staff_id_fkey
    FOREIGN KEY (uploader_brand_staff_id) REFERENCES public.brand_staff(id) ON DELETE SET NULL,
  CONSTRAINT oren_scene_posts_uploader_user_id_fkey
    FOREIGN KEY (uploader_user_id) REFERENCES public.users(id) ON DELETE SET NULL,
  CONSTRAINT oren_scene_posts_uploader_type_check
    CHECK (uploader_type IN ('owner', 'brand', 'customer')),
  CONSTRAINT oren_scene_posts_link_type_check
    CHECK (link_type IN ('booking', 'brand_product', 'product', 'none')),
  CONSTRAINT chk_link_type_consistency CHECK (
    (
      link_type = 'booking'
      AND booking_id IS NOT NULL
      AND brand_product_id IS NULL
      AND product_id IS NULL
    )
    OR (
      link_type = 'brand_product'
      AND brand_product_id IS NOT NULL
      AND booking_id IS NULL
      AND product_id IS NULL
    )
    OR (
      link_type = 'product'
      AND product_id IS NOT NULL
      AND booking_id IS NULL
      AND brand_product_id IS NULL
    )
    OR (
      link_type = 'none'
      AND booking_id IS NULL
      AND brand_product_id IS NULL
      AND product_id IS NULL
    )
  ),
  CONSTRAINT chk_uploader_consistency CHECK (
    (
      uploader_type IN ('owner', 'customer')
      AND uploader_user_id IS NOT NULL
      AND uploader_brand_staff_id IS NULL
    )
    OR (
      uploader_type = 'brand'
      AND uploader_brand_staff_id IS NOT NULL
      AND uploader_user_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_oren_scene_posts_salon_id
  ON public.oren_scene_posts USING btree (salon_id);

CREATE INDEX IF NOT EXISTS idx_oren_scene_posts_published_created
  ON public.oren_scene_posts USING btree (is_published, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_oren_scene_posts_highlight_tag
  ON public.oren_scene_posts USING btree (salon_id, highlight_tag)
  WHERE highlight_tag IS NOT NULL;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS helpful_concerns text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS skin_type text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS usage_period text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS effect_tags text[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_best boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS helpful_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_shared_community boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS community_post_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS is_store_review boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS store_order_no text DEFAULT NULL;

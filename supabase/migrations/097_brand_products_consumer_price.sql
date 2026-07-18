ALTER TABLE public.brand_products
  ADD COLUMN IF NOT EXISTS consumer_price INTEGER NOT NULL DEFAULT 0
  CHECK (consumer_price >= 0);

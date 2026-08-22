ALTER TABLE public.brand_order_batches
  ADD COLUMN IF NOT EXISTS owner_note text;

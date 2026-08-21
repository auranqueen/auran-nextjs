ALTER TABLE public.brand_arete_invoices
  ADD COLUMN IF NOT EXISTS kit_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS ship_status text,
  ADD COLUMN IF NOT EXISTS tracking_no text,
  ADD COLUMN IF NOT EXISTS courier text,
  ADD COLUMN IF NOT EXISTS shipped_at timestamptz;

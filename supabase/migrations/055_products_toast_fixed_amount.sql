ALTER TABLE products
  ADD COLUMN IF NOT EXISTS toast_fixed_amount integer NOT NULL DEFAULT 0;

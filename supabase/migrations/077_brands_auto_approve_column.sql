-- 077_brands_auto_approve_column.sql
ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS auto_approve_owner_invite BOOLEAN NOT NULL DEFAULT false;

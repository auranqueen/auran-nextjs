ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS renobel_unlocked boolean NOT NULL DEFAULT false;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS access_tier text NOT NULL DEFAULT 'public';

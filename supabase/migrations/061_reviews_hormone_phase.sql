ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS hormone_phase text DEFAULT NULL;

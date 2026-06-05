ALTER TABLE public.share_logs ADD COLUMN IF NOT EXISTS ip_address text DEFAULT NULL;

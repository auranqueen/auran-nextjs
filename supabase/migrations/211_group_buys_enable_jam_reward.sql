ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS enable_jam_reward boolean NOT NULL DEFAULT false;

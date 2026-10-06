CREATE TABLE IF NOT EXISTS public.group_buy_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id),
  product_id uuid NOT NULL REFERENCES public.products(id),
  message text,
  desired_start_at date,
  desired_end_at date,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Supabase에서 직접 실행 완료

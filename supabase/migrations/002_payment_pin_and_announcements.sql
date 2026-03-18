-- Payment PIN columns on users (for 결제 PIN 시스템)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS payment_pin_hash TEXT,
  ADD COLUMN IF NOT EXISTS payment_pin_set_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_failed_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- Announcements (전체공지)
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  content TEXT,
  type TEXT DEFAULT 'security',
  is_pinned BOOLEAN DEFAULT false,
  target_role TEXT DEFAULT 'all',
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

-- Personal notifications (개인알림)
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  body TEXT,
  type TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  action_url TEXT
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);

-- Skin analysis (고객 피부분석)
CREATE TABLE IF NOT EXISTS public.skin_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  skin_type TEXT,
  skin_concerns TEXT[],
  lifestyle_data JSONB,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skin_analysis_user_id ON public.skin_analysis(user_id);

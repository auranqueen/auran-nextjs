-- 채팅 알림음 선택 (마이 프로필)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notification_sound TEXT DEFAULT 'violet';

COMMENT ON COLUMN public.profiles.notification_sound IS '채팅 알림음 프리셋 id: violet, toast, luxury, magic, aube';

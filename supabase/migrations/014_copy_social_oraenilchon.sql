INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('copy_social', 'follow_btn', '오랜일촌 맺기', '맺기 버튼', '', 'text'),
  ('copy_social', 'following_btn', '오랜일촌 ✓', '맺은 상태 버튼', '', 'text'),
  ('copy_social', 'unfollow_btn', '오랜일촌 끊기', '끊기 버튼', '', 'text'),
  ('copy_social', 'follower_label', '오랜일촌', '오랜일촌 라벨', '', 'text'),
  ('copy_social', 'following_label', '내 오랜일촌', '내가 맺은 라벨', '', 'text'),
  ('copy_social', 'notify_text', '님이 오랜일촌을 신청했어요 🤝', '알림 문구', '', 'text'),
  ('copy_social', 'new_follower_text', '새 오랜일촌이 생겼어요!', '새 알림 문구', '', 'text')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

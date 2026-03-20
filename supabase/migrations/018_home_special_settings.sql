INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('home_special', 'title', '오늘의 특가', '섹션 제목', '', 'text'),
  ('home_special', 'enabled', '1', '특가 섹션 활성화', '', 'number'),
  ('home_special', 'max_items', '8', '표시 상품 수', '개', 'number'),
  ('home_special', 'rolling_interval_sec', '6', '롤링 간격', '초', 'number'),
  ('home_special', 'autoplay_enabled', '1', '자동 롤링 활성화', '', 'number'),
  ('home_special', 'manual_nav_enabled', '1', '수동 좌우 버튼 활성화', '', 'number'),
  ('home_special', 'autoplay_resume_delay_sec', '8', '수동 조작 후 자동재개 지연', '초', 'number'),
  ('home_special', 'swipe_enabled', '1', '스와이프 활성화', '', 'number'),
  ('home_special', 'swipe_threshold_px', '40', '스와이프 전환 기준', 'px', 'number'),
  ('home_special', 'show_timer', '1', '카운트다운 표시', '', 'number')
ON CONFLICT (category, key) DO UPDATE
SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = now();

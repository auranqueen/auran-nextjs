INSERT INTO public.admin_settings (category, key, value, label, unit, value_type)
VALUES
  ('seo', 'site_title', 'AURAN — 클리닉 뷰티 플랫폼', '사이트 제목', '', 'text'),
  ('seo', 'site_description', 'AI 피부분석 기반 클리닉 전용 스킨케어', '사이트 설명', '', 'text'),
  ('seo', 'naver_site_verification', '', '네이버 사이트 인증코드', '', 'text'),
  ('seo', 'google_site_verification', '', '구글 사이트 인증코드', '', 'text'),
  ('seo', 'og_default_image', 'https://auran.kr/og-default.jpg', '기본 OG 이미지', '', 'text')
ON CONFLICT (category, key)
DO UPDATE SET
  value = EXCLUDED.value,
  label = EXCLUDED.label,
  unit = EXCLUDED.unit,
  value_type = EXCLUDED.value_type,
  updated_at = NOW();

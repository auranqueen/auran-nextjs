-- 홈 큐레이션·배너용 admin_settings 컬럼 + 시드

ALTER TABLE public.admin_settings
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

INSERT INTO public.admin_settings (category, key, value, label, is_active, sort_order)
VALUES
  ('home_curation', 'section_1', '지성', '수분 부족 지성피부 추천해요 💧', true, 1),
  ('home_curation', 'section_2', '민감성', '민감·홍조 피부 진정 케어 🌿', true, 2),
  ('home_curation', 'section_3', '건성', '속당김 잡는 보습 솔루션 ✨', true, 3),
  ('home_curation', 'section_4', '안티에이징', '탄력·리프팅 집중 케어 💪', true, 4)
ON CONFLICT (category, key) DO NOTHING;

INSERT INTO public.admin_settings (category, key, value, label, is_active, sort_order)
VALUES
  (
    'home_banner',
    'slide_1',
    'https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1200&q=80',
    '겨울 보습 시즌',
    true,
    1
  ),
  (
    'home_banner',
    'slide_2',
    'https://images.unsplash.com/photo-1616394584738-fc6e612e71b1?w=1200&q=80',
    'AI 피부 맞춤 케어',
    true,
    2
  ),
  (
    'home_banner',
    'slide_3',
    'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&q=80',
    '프리미엄 브랜드',
    true,
    3
  )
ON CONFLICT (category, key) DO NOTHING;

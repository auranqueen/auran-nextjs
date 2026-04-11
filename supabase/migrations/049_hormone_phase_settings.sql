INSERT INTO public.admin_settings
  (id, category, key, value, label, is_active)
VALUES
  (uuid_generate_v4(), 'hormone_phase', 'moon_body',  '', '달빛기 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'moon_care',  '', '달빛기 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'moon_quote', '', '달빛기 오랜한마디', true),
  (uuid_generate_v4(), 'hormone_phase', 'gold_body',  '', '황금기 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'gold_care',  '', '황금기 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'gold_quote', '', '황금기 오랜한마디', true),
  (uuid_generate_v4(), 'hormone_phase', 'bloom_body',  '', '만개기 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'bloom_care',  '', '만개기 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'bloom_quote', '', '만개기 오랜한마디', true),
  (uuid_generate_v4(), 'hormone_phase', 'fall_body',  '', '물들기 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'fall_care',  '', '물들기 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'fall_quote', '', '물들기 오랜한마디', true),
  (uuid_generate_v4(), 'hormone_phase', 'meno_body',  '', '갱년기 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'meno_care',  '', '갱년기 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'meno_quote', '', '갱년기 오랜한마디', true),
  (uuid_generate_v4(), 'hormone_phase', 'male_body',  '', '남성 몸의변화', true),
  (uuid_generate_v4(), 'hormone_phase', 'male_care',  '', '남성 케어포인트', true),
  (uuid_generate_v4(), 'hormone_phase', 'male_quote', '', '남성 오랜한마디', true)
ON CONFLICT (category, key) DO NOTHING;

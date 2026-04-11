INSERT INTO public.admin_settings
  (id, category, key, value, label, is_active)
VALUES
  (uuid_generate_v4(), 'body_care', 'moon_title',  '', '달빛기 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'moon_quote',  '', '달빛기 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'fall_title',  '', '물들기 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'fall_quote',  '', '물들기 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'meno_title',  '', '갱년기 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'meno_quote',  '', '갱년기 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'male_title',  '', '남성 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'male_quote',  '', '남성 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'senior_title', '', '50대이상 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'senior_quote', '', '50대이상 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'moon_care',   '', '달빛기 케어방법', true),
  (uuid_generate_v4(), 'body_care', 'fall_care',   '', '물들기 케어방법', true),
  (uuid_generate_v4(), 'body_care', 'meno_care',   '', '갱년기 케어방법', true),
  (uuid_generate_v4(), 'body_care', 'male_care',   '', '남성 케어방법', true),
  (uuid_generate_v4(), 'body_care', 'senior_care', '', '50대이상 케어방법', true),
  (uuid_generate_v4(), 'body_care', 'stress_title', '', '스트레스 카드 타이틀', true),
  (uuid_generate_v4(), 'body_care', 'stress_quote', '', '스트레스 원장한마디', true),
  (uuid_generate_v4(), 'body_care', 'stress_care',  '', '스트레스 케어방법', true)
ON CONFLICT (category, key) DO NOTHING;

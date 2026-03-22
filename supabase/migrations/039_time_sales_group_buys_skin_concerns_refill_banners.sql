-- 타임세일 / 공구 / 피부 고민 카테고리 / 소진 알림 / 히어로 배너
-- (Supabase SQL Editor에서 실행하거나: supabase db push / 링크된 프로젝트에 마이그레이션 적용)

-- 타임세일
CREATE TABLE IF NOT EXISTS public.time_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products (id),
  discount_rate integer NOT NULL,
  original_price integer NOT NULL,
  sale_price integer NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 공구
CREATE TABLE IF NOT EXISTS public.group_buys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products (id),
  target_count integer NOT NULL,
  current_count integer DEFAULT 0,
  discount_rate integer NOT NULL,
  original_price integer NOT NULL,
  group_price integer NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 피부 고민 카테고리
CREATE TABLE IF NOT EXISTS public.skin_concerns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  icon text NOT NULL,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 소진 알림
CREATE TABLE IF NOT EXISTS public.refill_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id),
  product_id uuid REFERENCES public.products (id),
  purchase_date date,
  usage_percent integer DEFAULT 0,
  alert_threshold integer DEFAULT 30,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 히어로 배너
CREATE TABLE IF NOT EXISTS public.banners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subtitle text,
  emoji text,
  gradient_from text DEFAULT '#1a0a2a',
  gradient_to text DEFAULT '#2d1545',
  link_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- 기본 데이터 삽입 (피부 고민 카테고리)
INSERT INTO public.skin_concerns (name, icon, sort_order)
VALUES
  ('수분부족', '💧', 1),
  ('미백·톤업', '✨', 2),
  ('모공·각질', '🔍', 3),
  ('민감·진정', '🌿', 4),
  ('안티에이징', '⏰', 5),
  ('자외선차단', '☀️', 6),
  ('탄력·리프팅', '💆', 7)
ON CONFLICT (name) DO NOTHING;

-- 기본 배너 데이터 (동일 제목 재실행 시 중복 방지)
INSERT INTO public.banners (title, subtitle, emoji, sort_order)
SELECT v.title, v.subtitle, v.emoji, v.sort_order
FROM (
  VALUES
    ('봄 피부 변화, AI가 먼저 알아챕니다', '✦ 3월 · SPRING SKIN', '🌸', 1),
    ('내 피부에 딱 맞는 제품 찾기', '✦ AI 피부분석', '🔬', 2),
    ('살롱 예약, 지금 바로', '✦ 내 주변 관리샵', '💆', 3)
) AS v (title, subtitle, emoji, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.banners b WHERE b.title = v.title AND b.sort_order = v.sort_order
);

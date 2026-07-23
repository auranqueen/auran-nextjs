-- 124_brand_grade_point_rates_table.sql
-- 기록용: brand_grade_point_rates (브랜드별 등급 적립율). DB에 이미 존재할 수 있음.

CREATE TABLE IF NOT EXISTS brand_grade_point_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id),
  grade TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (brand_id, grade)
);

INSERT INTO brand_grade_point_rates (brand_id, grade, rate) VALUES
  ('60413ded-91f4-4004-b677-ae684cb0677e', '메디슈티컬', 5),
  ('60413ded-91f4-4004-b677-ae684cb0677e', '프리미엄전문점', 3),
  ('60413ded-91f4-4004-b677-ae684cb0677e', '전문점', 2),
  ('60413ded-91f4-4004-b677-ae684cb0677e', '취급점', 2)
ON CONFLICT (brand_id, grade) DO NOTHING;

-- 122_hq_commission_rates.sql
-- 트랙B HQ 재고발주 스폰서 커미션 요율 (오렌 자체 관리)
-- DB는 이미 반영됨 — 레포 기록용

CREATE TABLE IF NOT EXISTS hq_commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grade TEXT NOT NULL UNIQUE,
  commission_rate NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE hq_commission_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY hq_commission_rates_admin_all ON public.hq_commission_rates
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'admin')
  );

INSERT INTO hq_commission_rates (grade, commission_rate) VALUES
  ('메디슈티컬', 35.00),
  ('전문점', 25.00),
  ('취급점', 20.00),
  ('프리미엄전문점', 30.00)
ON CONFLICT (grade) DO NOTHING;

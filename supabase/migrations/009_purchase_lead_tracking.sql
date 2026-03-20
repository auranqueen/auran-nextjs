-- ============================================================
-- 9. 공유링크 구매 유도 트래킹 + 추천 포인트
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS share_journal_id UUID REFERENCES public.skin_journals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS purchase_lead_rewarded BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_orders_share_journal_id ON public.orders(share_journal_id);

-- 추천(구매 유도) 포인트: 기본 8,888P (admin_settings에서 수정 가능)
INSERT INTO public.admin_settings (category, key, value)
VALUES
  ('star_system', 'purchase_lead_points', '8888')
ON CONFLICT (category, key)
DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


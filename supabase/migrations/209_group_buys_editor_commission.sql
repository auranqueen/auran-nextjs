-- 209_group_buys_editor_commission.sql
-- group_buys 에디터 수수료 + 누락 컬럼 정리

-- 1. 운영 DB에만 있고 레포에 없는 컬럼 6개 동기화
ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS gift_title text,
  ADD COLUMN IF NOT EXISTS gift_description text,
  ADD COLUMN IF NOT EXISTS gift_points integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievement_reward_type text,
  ADD COLUMN IF NOT EXISTS achievement_reward_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS achievement_message text;

-- 2. 에디터 수수료 전용 컬럼 추가
ALTER TABLE public.group_buys
  ADD COLUMN IF NOT EXISTS editor_commission_type text DEFAULT 'pct' CHECK (editor_commission_type IN ('pct','fixed')),
  ADD COLUMN IF NOT EXISTS editor_commission_value integer DEFAULT 0;
-- editor_commission_type: 'pct'=퍼센트, 'fixed'=건당 고정금액
-- editor_commission_value: pct면 % 숫자(예:10), fixed면 원 금액(예:5000)

-- group_buy_requests에 희망 기간 및 어드민 메모 컬럼 추가
ALTER TABLE group_buy_requests
ADD COLUMN IF NOT EXISTS desired_start_at date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS desired_end_at date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS admin_note text DEFAULT NULL;

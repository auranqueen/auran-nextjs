-- Migration 217: magazines 노출 숨김 사유·시각 (운영 DB 직접 실행 완료)
ALTER TABLE magazines
  ADD COLUMN IF NOT EXISTS hidden_reason text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS hidden_at timestamp with time zone DEFAULT NULL;

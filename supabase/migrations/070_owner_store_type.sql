-- profiles: 오프라인 매장 유무 + 업종 (원장 가입/스토어 설정용)
-- has_offline_store: TRUE=오프라인 매장 있음, FALSE=온라인만, NULL=미입력
-- store_type: 피부관리실 | 왁싱샵 | 네일샵 | 반영구샵 | 자유기재 (TEXT, enum 아님)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS has_offline_store BOOLEAN DEFAULT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS store_type TEXT DEFAULT NULL;

COMMENT ON COLUMN public.profiles.has_offline_store IS
  '오프라인 매장 유무. TRUE=오프라인 매장 있음, FALSE=온라인만 운영, NULL=미입력';

COMMENT ON COLUMN public.profiles.store_type IS
  '업종. 피부관리실 | 왁싱샵 | 네일샵 | 반영구샵 | 자유기재 중 하나를 TEXT로 저장 (enum 아님). NULL=미입력';

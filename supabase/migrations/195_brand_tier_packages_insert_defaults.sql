-- 195_brand_tier_packages_insert_defaults.sql
-- 브랜드허브에서 등급 패키지 신규 생성 시 commission_rate를 보내지 않음.
-- 오렌 전용값 — DEFAULT만 두고 앱 insert/update/select에 절대 포함하지 않음.

ALTER TABLE public.brand_tier_packages
  ALTER COLUMN commission_rate SET DEFAULT 0;

COMMENT ON COLUMN public.brand_tier_packages.commission_rate IS
  '오렌 전용 스폰서 커미션율. 브랜드허브 API는 읽기·쓰기 금지. 미지정 insert 시 0.';

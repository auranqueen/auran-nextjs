-- 169: salons 위도/경도 (nullable). 대시보드에서 직접 실행.
ALTER TABLE salons ADD COLUMN IF NOT EXISTS lat double precision;
ALTER TABLE salons ADD COLUMN IF NOT EXISTS lng double precision;

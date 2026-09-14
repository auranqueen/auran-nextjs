-- 198_education_sessions_asset_url.sql
-- 이미 운영 DB에 존재하는 컬럼을 마이그레이션 파일로 기록만 함.
-- 실행 불필요. (197와 동일: 운영 스키마와 git 기록을 맞추는 문서화)
--
-- education_sessions.asset_url (text)
-- 181 CREATE TABLE에는 없음. 이후 ALTER 파일도 git에 없었음.
-- 브랜드사 education/sessions/save · attach-file이 이 컬럼에 값을 씀.

ALTER TABLE public.education_sessions
  ADD COLUMN IF NOT EXISTS asset_url text;

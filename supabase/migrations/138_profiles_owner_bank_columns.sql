-- 138_profiles_owner_bank_columns.sql
-- 원장 송금계좌 (profiles). DB는 이미 반영됨 — 레포 기록용

alter table profiles
  add column if not exists owner_bank_name text,
  add column if not exists owner_bank_account text,
  add column if not exists owner_bank_holder text;

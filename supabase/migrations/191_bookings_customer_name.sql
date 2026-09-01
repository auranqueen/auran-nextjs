-- 191: bookings.customer_name — 원장 예약 수동추가 임시 응급조치
-- 직접 Supabase SQL editor 에서 실행.
-- 정리 대상: 이후 external_customers 통합 시 이 컬럼 의존을 제거하고 연결 키로 대체.
alter table public.bookings
  add column if not exists customer_name text;

comment on column public.bookings.customer_name is
  '임시: 원장 수동추가 고객명 텍스트. nullable. external_customers 통합 시 정리 대상.';

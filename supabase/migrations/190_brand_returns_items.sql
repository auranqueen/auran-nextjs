-- 190: brand_returns.items — 주문 라인 스냅샷 (brand_orders.items 와 동일 구조)
-- 직접 Supabase SQL editor 에서 실행.
alter table public.brand_returns
  add column if not exists items jsonb not null default '[]'::jsonb;

comment on column public.brand_returns.items is
  '주문 라인 스냅샷 [{ product_id, name, qty, unit_price, line_amount, bonus, promo }]. 반품은 발주건 통째 + 증정 포함.';

-- 살롱스토어 정산 집계를 DB에서 직접 처리(limit 잘림 방지) + 관리자 전용 체크 내장. DB는 이미 반영됨 — 레포 기록용
create or replace function public.get_salon_store_pending_by_salon()
returns table(
  salon_id uuid,
  salon_name text,
  owner_name text,
  pending_count bigint,
  pending_amount bigint,
  bpo_ids uuid[],
  psu_ids uuid[]
)
language plpgsql
security definer
as $$
begin
  if not exists (select 1 from users where auth_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return query
  with combined as (
    select id, salon_id, owner_amount, 'bpo'::text as source
    from brand_product_orders
    where status = any(array['결제완료','배송중','배송완료','구매확정'])
      and (settlement_status is null or settlement_status <> '정산완료')
    union all
    select psu.id, p.salon_id, psu.owner_amount, 'purchase_session'::text as source
    from purchase_session_usages psu
    join purchases p on p.id = psu.purchase_id
    where psu.settlement_status = 'pending'
  )
  select
    c.salon_id,
    coalesce(s.name, '살롱') as salon_name,
    coalesce(u.name, '원장') as owner_name,
    count(*)::bigint as pending_count,
    sum(coalesce(c.owner_amount, 0))::bigint as pending_amount,
    array_agg(c.id) filter (where c.source = 'bpo') as bpo_ids,
    array_agg(c.id) filter (where c.source = 'purchase_session') as psu_ids
  from combined c
  join salons s on s.id = c.salon_id
  left join users u on u.id = s.owner_id
  group by c.salon_id, s.name, u.name
  order by pending_amount desc;
end;
$$;

create or replace function public.get_salon_store_settled_total()
returns bigint
language plpgsql
security definer
as $$
declare
  v_total bigint;
begin
  if not exists (select 1 from users where auth_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  select coalesce(sum(t.amt), 0)::bigint into v_total from (
    select owner_amount as amt from brand_product_orders where settlement_status = '정산완료'
    union all
    select owner_amount as amt from purchase_session_usages where settlement_status = '정산완료'
  ) t;
  return v_total;
end;
$$;
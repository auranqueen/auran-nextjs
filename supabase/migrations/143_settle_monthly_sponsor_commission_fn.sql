-- 월정산을 원자적(트랜잭션)으로 처리하는 함수. DB는 이미 반영됨 — 레포 기록용
create or replace function public.settle_monthly_sponsor_commission(
  p_period_start timestamptz,
  p_period_end timestamptz
)
returns table(out_batch_id uuid, out_batch_seq int, out_item_count int, out_total_amount bigint)
language plpgsql
security definer
as $$
declare
  v_batch_id uuid;
  v_next_seq int;
  v_count int;
  v_total bigint;
begin
  select count(*), coalesce(sum(commission_amount), 0)
  into v_count, v_total
  from hq_commission_ledger
  where status = 'pending'
    and created_at >= p_period_start
    and created_at <= p_period_end;
  if v_count = 0 then
    return query select null::uuid, null::int, 0, 0::bigint;
    return;
  end if;
  select coalesce(max(batch_seq), 0) + 1 into v_next_seq
  from hq_settlement_batches
  where settlement_type = 'sponsor_commission';
  insert into hq_settlement_batches (settlement_type, track, batch_seq, period_start, period_end, item_count, total_amount)
  values ('sponsor_commission', 'B', v_next_seq, p_period_start, p_period_end, v_count, v_total)
  returning id into v_batch_id;
  update hq_commission_ledger
  set status = 'paid', paid_at = now(), batch_id = v_batch_id
  where status = 'pending'
    and created_at >= p_period_start
    and created_at <= p_period_end;
  return query select v_batch_id, v_next_seq, v_count, v_total;
end;
$$;
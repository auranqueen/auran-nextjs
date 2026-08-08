-- 137_hq_stock_order_lines_company_rls.sql
-- Already applied (or to be applied) on Supabase; recorded for repo history.
-- Widen hq_stock_order_lines access from single brand_id to parent company_id
-- so sibling-brand staff can see all lines of a multi-brand order.

drop policy if exists "hq_stock_order_lines_brand_access" on hq_stock_order_lines;
drop policy if exists "hq_stock_order_lines_company_access" on hq_stock_order_lines;

create policy "hq_stock_order_lines_company_access"
on hq_stock_order_lines for all
using (
  exists (select 1 from users u where u.auth_id = auth.uid() and u.role = 'admin')
  or exists (
    select 1 from hq_stock_orders o
    join brands b on b.company_id = o.company_id
    where o.id = hq_stock_order_lines.order_id
      and (b.user_id = current_user_id() or b.user_id = auth.uid())
  )
  or exists (
    select 1 from hq_stock_orders o
    join brands b on b.company_id = o.company_id
    join brand_members bm on bm.brand_id = b.id
    join users u on u.id = bm.user_id
    where o.id = hq_stock_order_lines.order_id
      and u.auth_id = auth.uid()
  )
);

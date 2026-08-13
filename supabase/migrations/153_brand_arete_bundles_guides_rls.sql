-- 아레테 번들/가이드 테이블 RLS. DB는 이미 반영됨 — 레포 기록용
alter table brand_arete_monthly_bundles enable row level security;
create policy brand_arete_monthly_bundles_company_all on brand_arete_monthly_bundles
  for all
  using (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_arete_monthly_bundles.company_id
        and (b.user_id = public.current_user_id() or b.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_arete_monthly_bundles.company_id
        and (b.user_id = public.current_user_id() or b.user_id = auth.uid())
    )
  );
alter table brand_arete_guide_images enable row level security;
create policy brand_arete_guide_images_company_all on brand_arete_guide_images
  for all
  using (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_arete_guide_images.company_id
        and (b.user_id = public.current_user_id() or b.user_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.brands b
      where b.company_id = brand_arete_guide_images.company_id
        and (b.user_id = public.current_user_id() or b.user_id = auth.uid())
    )
  );

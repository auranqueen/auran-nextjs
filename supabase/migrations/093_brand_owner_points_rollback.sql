-- 093_brand_owner_points_rollback.sql
-- 093_brand_owner_points.sql 역순 롤백 (실행은 수동)

-- 1) balance RLS
DROP POLICY IF EXISTS brand_owner_point_balance_admin_all ON public.brand_owner_point_balance;
DROP POLICY IF EXISTS brand_owner_point_balance_brand_select ON public.brand_owner_point_balance;
DROP POLICY IF EXISTS brand_owner_point_balance_owner_select ON public.brand_owner_point_balance;
ALTER TABLE public.brand_owner_point_balance DISABLE ROW LEVEL SECURITY;

-- 2) ledger RLS
DROP POLICY IF EXISTS brand_owner_point_ledger_admin_all ON public.brand_owner_point_ledger;
DROP POLICY IF EXISTS brand_owner_point_ledger_brand_select ON public.brand_owner_point_ledger;
DROP POLICY IF EXISTS brand_owner_point_ledger_owner_select ON public.brand_owner_point_ledger;
ALTER TABLE public.brand_owner_point_ledger DISABLE ROW LEVEL SECURITY;

-- 3) brand_companies RLS
DROP POLICY IF EXISTS brand_companies_admin_all ON public.brand_companies;
DROP POLICY IF EXISTS brand_companies_brand_select ON public.brand_companies;
ALTER TABLE public.brand_companies DISABLE ROW LEVEL SECURITY;

-- 4) tables (FK 순서)
DROP TABLE IF EXISTS public.brand_owner_point_balance;
DROP TABLE IF EXISTS public.brand_owner_point_ledger;

DROP INDEX IF EXISTS public.idx_brands_company_id;

ALTER TABLE public.brands
  DROP COLUMN IF EXISTS company_id;

DROP TABLE IF EXISTS public.brand_companies;

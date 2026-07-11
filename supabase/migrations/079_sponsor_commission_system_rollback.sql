-- 079_sponsor_commission_system_rollback.sql
-- 079_sponsor_commission_system.sql 역순 롤백 (실행은 수동)

-- ============================================================
-- 1. RLS 정책 제거 (생성 역순)
-- ============================================================

DROP POLICY IF EXISTS sponsor_eligibility_admin_all ON public.sponsor_eligibility;
DROP POLICY IF EXISTS sponsor_eligibility_owner_select ON public.sponsor_eligibility;

DROP POLICY IF EXISTS sponsor_commission_ledger_admin_all ON public.sponsor_commission_ledger;
DROP POLICY IF EXISTS sponsor_commission_ledger_party_select ON public.sponsor_commission_ledger;

DROP POLICY IF EXISTS brand_tier_orders_admin_all ON public.brand_tier_orders;
DROP POLICY IF EXISTS brand_tier_orders_owner_select ON public.brand_tier_orders;

DROP POLICY IF EXISTS brand_tier_packages_admin_all ON public.brand_tier_packages;
DROP POLICY IF EXISTS brand_tier_packages_brand_select ON public.brand_tier_packages;

DROP POLICY IF EXISTS brand_owner_grades_admin_all ON public.brand_owner_grades;
DROP POLICY IF EXISTS brand_owner_grades_brand_write ON public.brand_owner_grades;
DROP POLICY IF EXISTS brand_owner_grades_owner_select ON public.brand_owner_grades;

-- ============================================================
-- 2. 테이블 DROP (FK 의존 역순)
-- ============================================================

DROP TABLE IF EXISTS public.sponsor_eligibility;
DROP TABLE IF EXISTS public.sponsor_commission_ledger;
DROP TABLE IF EXISTS public.brand_tier_orders;
DROP TABLE IF EXISTS public.brand_tier_packages;

-- ============================================================
-- 3. brand_owner_grades 확장 컬럼·제약 제거
-- ============================================================

DROP INDEX IF EXISTS public.idx_brand_owner_grades_sponsor_owner_id;

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_grade_check;

ALTER TABLE public.brand_owner_grades
  DROP CONSTRAINT IF EXISTS brand_owner_grades_payment_status_check;

ALTER TABLE public.brand_owner_grades
  DROP COLUMN IF EXISTS grade_purchased_at,
  DROP COLUMN IF EXISTS payment_status,
  DROP COLUMN IF EXISTS purchase_amount,
  DROP COLUMN IF EXISTS care_enabled,
  DROP COLUMN IF EXISTS sponsor_owner_id;

-- Allow authenticated admins to INSERT products (admin product UI uses browser Supabase client).
-- 기존 INSERT 정책은 "brand can insert own products" 하나뿐이라 브랜드 소속 제품만 허용됐고,
-- /admin/products/edit-v2 신규 등록 시 "new row violates row-level security policy" 발생.
-- 038_products_admin_update_policy.sql의 admin 판별 조건을 그대로 재사용한다.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'admin can insert products'
  ) THEN
    CREATE POLICY "admin can insert products"
    ON public.products
    FOR INSERT
    TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_id = auth.uid() AND u.role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.auth_id = auth.uid() AND p.role = 'admin'
      )
    );

    COMMENT ON POLICY "admin can insert products" ON public.products IS '관리자가 브랜드 소속과 무관하게 제품을 신규 등록할 수 있도록 허용. 기존 brand can insert own products 정책과 병행.';
  END IF;
END $$;

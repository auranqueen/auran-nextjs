-- Allow authenticated admins to UPDATE products (marketing admin UI uses browser Supabase client).
-- Read-only policy was added in 017; without UPDATE policy, all .update() calls fail under RLS.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'admin update products'
  ) THEN
    CREATE POLICY "admin update products"
    ON public.products
    FOR UPDATE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.auth_id = auth.uid() AND u.role = 'admin'
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.auth_id = auth.uid() AND p.role = 'admin'
      )
    )
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
  END IF;
END $$;

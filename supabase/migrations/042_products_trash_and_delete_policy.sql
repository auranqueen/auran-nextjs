-- Add soft-delete timestamp for product trash system.
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Allow authenticated admins to permanently delete products (trash empty / per-item 영구삭제).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'products'
      AND policyname = 'admin delete products'
  ) THEN
    CREATE POLICY "admin delete products"
    ON public.products
    FOR DELETE
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
    );
  END IF;
END $$;


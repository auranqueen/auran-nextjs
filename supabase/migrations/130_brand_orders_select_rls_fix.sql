-- 130_brand_orders_select_rls_fix.sql
-- DB already applied; repo documentation for brand_orders SELECT RLS.
-- Allows brand owner OR brand_members to select orders for that brand.

DROP POLICY IF EXISTS "brand can select own orders" ON brand_orders;
CREATE POLICY "brand can select own orders" ON brand_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM brands
      WHERE brands.id = brand_orders.brand_id
        AND brands.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM brand_members
      WHERE brand_members.brand_id = brand_orders.brand_id
        AND brand_members.user_id = auth.uid()
    )
  );

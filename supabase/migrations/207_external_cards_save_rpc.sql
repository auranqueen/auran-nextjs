DROP FUNCTION IF EXISTS save_external_card(TEXT, TEXT, UUID, JSONB);
DROP FUNCTION IF EXISTS delete_external_customer(UUID);
CREATE OR REPLACE FUNCTION save_external_card(
  p_customer_name TEXT,
  p_memo TEXT,
  p_card_id UUID,
  p_card_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_id UUID;
  v_total_amount INTEGER;
  v_visit_count INTEGER;
  v_card_amount INTEGER;
BEGIN
  v_card_amount := COALESCE((p_card_payload->>'total_amount')::INTEGER, 0);
  SELECT id INTO v_customer_id
  FROM external_customers
  WHERE name = p_customer_name
    AND owner_id IS NULL
  LIMIT 1;
  IF v_customer_id IS NOT NULL THEN
    SELECT COALESCE(SUM(total_amount), 0) INTO v_total_amount
    FROM external_care_cards_v2
    WHERE customer_id = v_customer_id
      AND (p_card_id IS NULL OR id != p_card_id);
    v_total_amount := v_total_amount + v_card_amount;
    SELECT COUNT(*) INTO v_visit_count
    FROM external_care_cards_v2
    WHERE customer_id = v_customer_id
      AND (p_card_id IS NULL OR id != p_card_id);
    v_visit_count := v_visit_count + CASE WHEN p_card_id IS NULL THEN 1 ELSE 0 END;
    UPDATE external_customers
    SET
      memo = COALESCE(p_memo, memo),
      phone = (p_card_payload->>'phone')::TEXT,
      address = (p_card_payload->>'address')::TEXT,
      channel = (p_card_payload->>'channel')::TEXT,
      total_amount = v_total_amount,
      visit_count = v_visit_count,
      last_purchase_at = NOW(),
      updated_at = NOW()
    WHERE id = v_customer_id
      AND owner_id IS NULL;
  ELSE
    INSERT INTO external_customers (
      name, memo, phone, address, channel,
      total_amount, visit_count, last_purchase_at
    )
    VALUES (
      p_customer_name,
      p_memo,
      (p_card_payload->>'phone')::TEXT,
      (p_card_payload->>'address')::TEXT,
      (p_card_payload->>'channel')::TEXT,
      v_card_amount, 1, NOW()
    )
    RETURNING id INTO v_customer_id;
  END IF;
  IF p_card_id IS NOT NULL THEN
    UPDATE external_care_cards_v2
    SET
      customer_name = p_customer_name,
      phone = (p_card_payload->>'phone')::TEXT,
      address = (p_card_payload->>'address')::TEXT,
      channel = (p_card_payload->>'channel')::TEXT,
      products = (p_card_payload->'products')::JSONB,
      total_amount = v_card_amount,
      delivery_type = (p_card_payload->>'delivery_type')::TEXT,
      tracking_no = (p_card_payload->>'tracking_no')::TEXT,
      shipped_at = (p_card_payload->>'shipped_at')::DATE,
      estimated_arrival = (p_card_payload->>'estimated_arrival')::DATE,
      am_routine = (p_card_payload->>'am_routine')::TEXT,
      pm_routine = (p_card_payload->>'pm_routine')::TEXT,
      tip = (p_card_payload->>'tip')::TEXT,
      status = (p_card_payload->>'status')::TEXT,
      gift_items = (p_card_payload->'gift_items')::JSONB,
      bundle_prods = (p_card_payload->'bundle_prods')::JSONB,
      sample_prods = (p_card_payload->'sample_prods')::JSONB,
      customer_id = v_customer_id,
      updated_at = NOW()
    WHERE id = p_card_id;
  ELSE
    INSERT INTO external_care_cards_v2 (
      customer_name, phone, address, channel, products, total_amount,
      delivery_type, tracking_no, shipped_at, estimated_arrival,
      am_routine, pm_routine, tip, status,
      gift_items, bundle_prods, sample_prods, customer_id
    ) VALUES (
      p_customer_name,
      (p_card_payload->>'phone')::TEXT,
      (p_card_payload->>'address')::TEXT,
      (p_card_payload->>'channel')::TEXT,
      (p_card_payload->'products')::JSONB,
      v_card_amount,
      (p_card_payload->>'delivery_type')::TEXT,
      (p_card_payload->>'tracking_no')::TEXT,
      (p_card_payload->>'shipped_at')::DATE,
      (p_card_payload->>'estimated_arrival')::DATE,
      (p_card_payload->>'am_routine')::TEXT,
      (p_card_payload->>'pm_routine')::TEXT,
      (p_card_payload->>'tip')::TEXT,
      (p_card_payload->>'status')::TEXT,
      (p_card_payload->'gift_items')::JSONB,
      (p_card_payload->'bundle_prods')::JSONB,
      (p_card_payload->'sample_prods')::JSONB,
      v_customer_id
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'customer_id', v_customer_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
CREATE OR REPLACE FUNCTION delete_external_customer(
  p_customer_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM external_customers
    WHERE id = p_customer_id AND owner_id IS NULL
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'customer_not_found');
  END IF;
  DELETE FROM external_care_cards_v2
  WHERE customer_id = p_customer_id;
  DELETE FROM external_customers
  WHERE id = p_customer_id
    AND owner_id IS NULL;
  RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$;
REVOKE EXECUTE ON FUNCTION save_external_card(TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION delete_external_customer(UUID) FROM PUBLIC, anon, authenticated;

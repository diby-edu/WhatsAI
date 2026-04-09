ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS customer_email TEXT;

UPDATE public.orders
SET customer_email = LOWER(
    SUBSTRING(
        notes
        FROM '(?i)(?:📧\s*)?email\s*:\s*([A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})'
    )
)
WHERE customer_email IS NULL
  AND notes IS NOT NULL
  AND notes ~* '(?:📧\s*)?email\s*:';

DROP FUNCTION IF EXISTS create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_user_id          UUID,
    p_agent_id         UUID,
    p_conversation_id  UUID,
    p_customer_name    TEXT,
    p_customer_phone   TEXT,
    p_customer_email   TEXT,
    p_delivery_address TEXT,
    p_payment_method   TEXT,
    p_notes            TEXT,
    p_total_fcfa       INTEGER,
    p_status           TEXT,
    p_items            JSONB
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id     UUID;
    v_order_number TEXT;
    v_item         JSONB;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required' USING ERRCODE = 'P0003';
    END IF;

    IF p_customer_phone IS NULL OR p_customer_phone = '' THEN
        RAISE EXCEPTION 'customer_phone is required' USING ERRCODE = 'P0004';
    END IF;

    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items array is required and must not be empty' USING ERRCODE = 'P0005';
    END IF;

    IF p_total_fcfa IS NULL OR p_total_fcfa < 0 THEN
        RAISE EXCEPTION 'total_fcfa must be >= 0' USING ERRCODE = 'P0006';
    END IF;

    INSERT INTO public.orders (
        user_id,
        agent_id,
        conversation_id,
        customer_name,
        customer_phone,
        customer_email,
        delivery_address,
        payment_method,
        notes,
        total_fcfa,
        status
    )
    VALUES (
        p_user_id,
        p_agent_id,
        p_conversation_id,
        COALESCE(p_customer_name, 'Non spécifié'),
        p_customer_phone,
        NULLIF(BTRIM(p_customer_email), ''),
        COALESCE(p_delivery_address, 'Non spécifié'),
        COALESCE(p_payment_method, 'online'),
        p_notes,
        p_total_fcfa,
        COALESCE(p_status, 'pending')
    )
    RETURNING id, orders.order_number INTO v_order_id, v_order_number;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.order_items (
            order_id,
            product_name,
            product_description,
            quantity,
            unit_price_fcfa
        )
        VALUES (
            v_order_id,
            v_item->>'product_name',
            v_item->>'product_description',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price_fcfa')::INTEGER
        );
    END LOOP;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;

GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB)
    TO service_role;

GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB)
    TO authenticated;

-- ═══════════════════════════════════════════════════════════════
-- FIX : Ambiguïté "column reference order_number is ambiguous"
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLÈME :
-- Dans la fonction create_order_with_items, RETURNS TABLE(order_number TEXT)
-- crée un paramètre OUT implicite nommé "order_number".
-- PostgreSQL ne sait pas si "order_number" dans la clause RETURNING
-- désigne la colonne de la table orders ou le paramètre OUT.
--
-- FIX :
-- Qualifier explicitement avec le nom de table : orders.order_number
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB);

CREATE OR REPLACE FUNCTION create_order_with_items(
    p_user_id          UUID,
    p_agent_id         UUID,
    p_conversation_id  UUID,
    p_customer_name    TEXT,
    p_customer_phone   TEXT,
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
        COALESCE(p_delivery_address, 'Non spécifié'),
        COALESCE(p_payment_method, 'online'),
        p_notes,
        p_total_fcfa,
        COALESCE(p_status, 'pending')
    )
    -- FIX : qualifier "orders.order_number" pour lever l'ambiguïté avec le paramètre OUT
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

GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB)
    TO service_role;

GRANT EXECUTE ON FUNCTION create_order_with_items(UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB)
    TO authenticated;

COMMENT ON FUNCTION create_order_with_items IS
'Crée une commande et ses articles dans une seule transaction.
Rollback automatique si l''insertion des articles échoue.
Fix 2026-03-19 : RETURNING orders.order_number pour lever ambiguïté avec paramètre OUT.';

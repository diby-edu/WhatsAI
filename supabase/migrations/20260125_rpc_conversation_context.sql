-- ═══════════════════════════════════════════════════════════════
-- RPC Function: get_conversation_context
-- Purpose: Reduce N+1 queries by fetching all conversation context in 1 call
-- Created: 2026-01-25
-- ═══════════════════════════════════════════════════════════════

-- Drop if exists (for idempotency)
DROP FUNCTION IF EXISTS get_conversation_context(TEXT, UUID, INT);

-- Create optimized RPC function
CREATE OR REPLACE FUNCTION get_conversation_context(
    p_phone TEXT,
    p_agent_id UUID,
    p_message_limit INT DEFAULT 50
)
RETURNS TABLE (
    conversation_id UUID,
    conversation_status TEXT,
    agent_name TEXT,
    agent_language TEXT,
    agent_use_emojis BOOLEAN,
    agent_business_address TEXT,
    agent_business_hours JSONB,
    user_credits INT,
    messages JSONB,
    recent_orders JSONB,
    products JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH conversation AS (
        SELECT c.id, c.status, c.agent_id
        FROM conversations c
        WHERE c.agent_id = p_agent_id
        AND (c.customer_phone LIKE '%' || p_phone OR c.customer_phone = p_phone)
        ORDER BY c.created_at DESC
        LIMIT 1
    ),
    agent_data AS (
        SELECT
            a.name,
            a.language,
            a.use_emojis,
            a.business_address,
            a.business_hours,
            a.user_id
        FROM agents a
        WHERE a.id = p_agent_id
    ),
    user_data AS (
        SELECT p.credits
        FROM profiles p
        WHERE p.id = (SELECT user_id FROM agent_data)
    ),
    messages_data AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'role', m.role,
                'content', m.content,
                'created_at', m.created_at
            ) ORDER BY m.created_at ASC
        ) as msgs
        FROM (
            SELECT role, content, created_at
            FROM messages
            WHERE conversation_id = (SELECT id FROM conversation)
            ORDER BY created_at DESC
            LIMIT p_message_limit
        ) m
    ),
    orders_data AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', o.id,
                'status', o.status,
                'total_fcfa', o.total_fcfa,
                'customer_name', o.customer_name,
                'customer_phone', o.customer_phone,
                'delivery_address', o.delivery_address,
                'created_at', o.created_at
            ) ORDER BY o.created_at DESC
        ) as orders
        FROM (
            SELECT id, status, total_fcfa, customer_name, customer_phone, delivery_address, created_at
            FROM orders
            WHERE agent_id = p_agent_id
            AND (customer_phone LIKE '%' || p_phone OR customer_phone = p_phone)
            ORDER BY created_at DESC
            LIMIT 10
        ) o
    ),
    products_data AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', p.id,
                'name', p.name,
                'price_fcfa', p.price_fcfa,
                'product_type', p.product_type,
                'service_subtype', p.service_subtype,
                'variants', p.variants,
                'stock_quantity', p.stock_quantity,
                'is_active', p.is_active
            )
        ) as prods
        FROM products p
        WHERE p.agent_id = p_agent_id
        AND p.is_active = true
    )
    SELECT
        conv.id as conversation_id,
        conv.status as conversation_status,
        ad.name as agent_name,
        ad.language as agent_language,
        ad.use_emojis as agent_use_emojis,
        ad.business_address as agent_business_address,
        ad.business_hours as agent_business_hours,
        COALESCE(ud.credits, 0) as user_credits,
        COALESCE(md.msgs, '[]'::jsonb) as messages,
        COALESCE(od.orders, '[]'::jsonb) as recent_orders,
        COALESCE(pd.prods, '[]'::jsonb) as products
    FROM conversation conv
    CROSS JOIN agent_data ad
    LEFT JOIN user_data ud ON true
    LEFT JOIN messages_data md ON true
    LEFT JOIN orders_data od ON true
    LEFT JOIN products_data pd ON true;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_conversation_context(TEXT, UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_conversation_context(TEXT, UUID, INT) TO service_role;

-- Comment for documentation
COMMENT ON FUNCTION get_conversation_context IS 'Fetches all conversation context in a single query to avoid N+1 queries. Returns agent info, messages, orders, and products.';

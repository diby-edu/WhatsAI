-- =============================================
-- Restaurant Engine - Phase 1 additive schema
-- Safe for production: additive changes only
-- =============================================

-- =============================================
-- 1. Products
-- =============================================
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS menu_section_slug TEXT;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS menu_sort_order INTEGER DEFAULT 100;

ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_menu_section_slug_check;

ALTER TABLE public.products
    ADD CONSTRAINT products_menu_section_slug_check
    CHECK (
        menu_section_slug IS NULL OR
        menu_section_slug IN ('starters', 'mains', 'extras', 'desserts', 'drinks', 'other')
    );

CREATE INDEX IF NOT EXISTS idx_products_restaurant_menu
    ON public.products(agent_id, service_subtype, menu_section_slug, menu_sort_order);

-- =============================================
-- 2. Agents
-- =============================================
ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.agents
    DROP CONSTRAINT IF EXISTS agents_restaurant_deposit_percentage_check;

ALTER TABLE public.agents
    ADD CONSTRAINT agents_restaurant_deposit_percentage_check
    CHECK (
        restaurant_deposit_percentage >= 0 AND
        restaurant_deposit_percentage <= 100
    );

-- =============================================
-- 3. Orders
-- =============================================
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_fulfillment_mode_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_mode_check
    CHECK (
        fulfillment_mode IS NULL OR
        fulfillment_mode IN ('takeaway', 'delivery')
    );

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_deposit_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_deposit_status_check
    CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'expired', 'waived'));

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'pending', 'paid', 'confirmed', 'pending_pickup', 'pending_delivery',
        'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
    ));

-- =============================================
-- 4. Bookings
-- =============================================
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_fulfillment_mode_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_fulfillment_mode_check
    CHECK (
        fulfillment_mode IS NULL OR
        fulfillment_mode IN ('dine_in', 'booking_only')
    );

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_method_check
    CHECK (
        payment_method IS NULL OR
        payment_method IN ('online', 'onsite')
    );

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_deposit_status_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_deposit_status_check
    CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'expired', 'waived'));

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'general';

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_booking_source_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_booking_source_check
    CHECK (
        booking_source IS NULL OR
        booking_source IN ('restaurant', 'general')
    );

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS transaction_id TEXT;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS provider_payment_url TEXT;

CREATE INDEX IF NOT EXISTS idx_bookings_transaction_id
    ON public.bookings(transaction_id);

-- =============================================
-- 5. booking_items + RLS
-- =============================================
CREATE TABLE IF NOT EXISTS public.booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_fcfa INTEGER NOT NULL DEFAULT 0,
    line_total_fcfa INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id
    ON public.booking_items(booking_id);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'bookings_select_agent'
    ) THEN
        CREATE POLICY "bookings_select_agent" ON public.bookings
            FOR SELECT USING (
                agent_id IN (
                    SELECT id FROM public.agents WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'bookings_insert_agent'
    ) THEN
        CREATE POLICY "bookings_insert_agent" ON public.bookings
            FOR INSERT WITH CHECK (
                agent_id IN (
                    SELECT id FROM public.agents WHERE user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'bookings'
          AND policyname = 'bookings_update_agent'
    ) THEN
        CREATE POLICY "bookings_update_agent" ON public.bookings
            FOR UPDATE USING (
                agent_id IN (
                    SELECT id FROM public.agents WHERE user_id = auth.uid()
                )
            );
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'booking_items'
          AND policyname = 'booking_items_select_agent'
    ) THEN
        CREATE POLICY "booking_items_select_agent" ON public.booking_items
            FOR SELECT USING (
                booking_id IN (
                    SELECT id
                    FROM public.bookings
                    WHERE agent_id IN (
                        SELECT id FROM public.agents WHERE user_id = auth.uid()
                    )
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'booking_items'
          AND policyname = 'booking_items_insert_agent'
    ) THEN
        CREATE POLICY "booking_items_insert_agent" ON public.booking_items
            FOR INSERT WITH CHECK (
                booking_id IN (
                    SELECT id
                    FROM public.bookings
                    WHERE agent_id IN (
                        SELECT id FROM public.agents WHERE user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

-- =============================================
-- 6. RPC create_restaurant_booking
-- =============================================
CREATE OR REPLACE FUNCTION create_restaurant_booking(
    p_agent_id UUID,
    p_user_id UUID,
    p_conversation_id UUID,
    p_fulfillment_mode TEXT,
    p_service_name TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_preferred_date DATE,
    p_preferred_time TIME,
    p_party_size INTEGER,
    p_payment_method TEXT,
    p_notes TEXT,
    p_deposit_required BOOLEAN,
    p_deposit_percentage INTEGER,
    p_deposit_amount_fcfa INTEGER,
    p_items JSONB,
    p_timezone TEXT DEFAULT 'Africa/Abidjan'
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_booking_id UUID;
    v_total_fcfa INTEGER := 0;
    v_item JSONB;
BEGIN
    IF p_agent_id IS NULL THEN
        RAISE EXCEPTION 'agent_id is required' USING ERRCODE = 'P0010';
    END IF;
    IF p_customer_phone IS NULL OR p_customer_phone = '' THEN
        RAISE EXCEPTION 'customer_phone is required' USING ERRCODE = 'P0011';
    END IF;
    IF p_fulfillment_mode NOT IN ('dine_in', 'booking_only') THEN
        RAISE EXCEPTION 'fulfillment_mode must be dine_in or booking_only' USING ERRCODE = 'P0012';
    END IF;
    IF p_preferred_date IS NULL OR p_preferred_time IS NULL THEN
        RAISE EXCEPTION 'preferred_date and preferred_time are required' USING ERRCODE = 'P0013';
    END IF;
    IF p_party_size IS NULL OR p_party_size < 1 THEN
        RAISE EXCEPTION 'party_size must be >= 1' USING ERRCODE = 'P0014';
    END IF;
    IF p_payment_method IS NULL OR p_payment_method NOT IN ('online', 'onsite') THEN
        RAISE EXCEPTION 'payment_method must be online or onsite' USING ERRCODE = 'P0015';
    END IF;

    SELECT COALESCE(
        SUM(
            COALESCE(
                (i->>'line_total_fcfa')::INTEGER,
                COALESCE((i->>'quantity')::INTEGER, 0) * COALESCE((i->>'unit_price_fcfa')::INTEGER, 0)
            )
        ),
        0
    )
    INTO v_total_fcfa
    FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) AS i;

    INSERT INTO public.bookings (
        agent_id,
        user_id,
        conversation_id,
        booking_type,
        fulfillment_mode,
        service_name,
        customer_name,
        customer_phone,
        preferred_date,
        preferred_time,
        start_time,
        party_size,
        payment_method,
        notes,
        price_fcfa,
        status,
        deposit_required,
        deposit_percentage,
        deposit_amount_fcfa,
        deposit_status,
        booking_source
    ) VALUES (
        p_agent_id,
        p_user_id,
        p_conversation_id,
        'table',
        p_fulfillment_mode,
        p_service_name,
        p_customer_name,
        p_customer_phone,
        p_preferred_date,
        p_preferred_time,
        (p_preferred_date::TEXT || ' ' || p_preferred_time::TEXT)::TIMESTAMP AT TIME ZONE p_timezone,
        p_party_size,
        p_payment_method,
        p_notes,
        v_total_fcfa,
        CASE WHEN COALESCE(p_deposit_required, FALSE) THEN 'pending' ELSE 'confirmed' END,
        COALESCE(p_deposit_required, FALSE),
        COALESCE(p_deposit_percentage, 0),
        COALESCE(p_deposit_amount_fcfa, 0),
        CASE WHEN COALESCE(p_deposit_required, FALSE) THEN 'pending' ELSE 'not_required' END,
        'restaurant'
    )
    RETURNING id INTO v_booking_id;

    FOR v_item IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        INSERT INTO public.booking_items (
            booking_id,
            product_id,
            product_name,
            product_category,
            quantity,
            unit_price_fcfa,
            line_total_fcfa
        ) VALUES (
            v_booking_id,
            NULLIF(v_item->>'product_id', '')::UUID,
            COALESCE(v_item->>'product_name', 'Produit restaurant'),
            v_item->>'product_category',
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->>'unit_price_fcfa')::INTEGER, 0),
            COALESCE(
                (v_item->>'line_total_fcfa')::INTEGER,
                COALESCE((v_item->>'quantity')::INTEGER, 0) * COALESCE((v_item->>'unit_price_fcfa')::INTEGER, 0)
            )
        );
    END LOOP;

    RETURN jsonb_build_object(
        'booking_id', v_booking_id,
        'total_fcfa', v_total_fcfa,
        'deposit_status', CASE WHEN COALESCE(p_deposit_required, FALSE) THEN 'pending' ELSE 'not_required' END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_restaurant_booking(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, DATE, TIME, INTEGER, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER, JSONB, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION create_restaurant_booking(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, DATE, TIME, INTEGER, TEXT, TEXT, BOOLEAN, INTEGER, INTEGER, JSONB, TEXT
) TO service_role;

-- =============================================
-- 7. RPC create_restaurant_order_with_items
-- =============================================
CREATE OR REPLACE FUNCTION create_restaurant_order_with_items(
    p_user_id UUID,
    p_agent_id UUID,
    p_conversation_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_delivery_address TEXT,
    p_payment_method TEXT,
    p_notes TEXT,
    p_total_fcfa INTEGER,
    p_status TEXT,
    p_items JSONB,
    p_fulfillment_mode TEXT,
    p_pickup_at TIMESTAMPTZ,
    p_deposit_required BOOLEAN DEFAULT FALSE,
    p_deposit_percentage INTEGER DEFAULT 0,
    p_deposit_amount_fcfa INTEGER DEFAULT 0,
    p_deposit_status TEXT DEFAULT 'not_required'
) RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_item JSONB;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required' USING ERRCODE = 'P0003';
    END IF;
    IF p_customer_phone IS NULL OR p_customer_phone = '' THEN
        RAISE EXCEPTION 'customer_phone is required' USING ERRCODE = 'P0004';
    END IF;
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items array is required' USING ERRCODE = 'P0005';
    END IF;
    IF p_fulfillment_mode NOT IN ('takeaway', 'delivery') THEN
        RAISE EXCEPTION 'fulfillment_mode must be takeaway or delivery' USING ERRCODE = 'P0006';
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
        status,
        fulfillment_mode,
        pickup_at,
        deposit_required,
        deposit_percentage,
        deposit_amount_fcfa,
        deposit_status
    ) VALUES (
        p_user_id,
        p_agent_id,
        p_conversation_id,
        p_customer_name,
        p_customer_phone,
        p_delivery_address,
        p_payment_method,
        p_notes,
        p_total_fcfa,
        p_status,
        p_fulfillment_mode,
        p_pickup_at,
        p_deposit_required,
        p_deposit_percentage,
        p_deposit_amount_fcfa,
        p_deposit_status
    )
    RETURNING id, orders.order_number INTO v_order_id, v_order_number;

    FOR v_item IN
        SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        INSERT INTO public.order_items (
            order_id,
            product_id,
            product_name,
            quantity,
            unit_price_fcfa
        ) VALUES (
            v_order_id,
            NULLIF(v_item->>'product_id', '')::UUID,
            COALESCE(v_item->>'product_name', 'Produit restaurant'),
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->>'unit_price_fcfa')::INTEGER, 0)
        );
    END LOOP;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;

GRANT EXECUTE ON FUNCTION create_restaurant_order_with_items(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, TEXT, TIMESTAMPTZ, BOOLEAN, INTEGER, INTEGER, TEXT
) TO authenticated;

GRANT EXECUTE ON FUNCTION create_restaurant_order_with_items(
    UUID, UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, JSONB, TEXT, TIMESTAMPTZ, BOOLEAN, INTEGER, INTEGER, TEXT
) TO service_role;

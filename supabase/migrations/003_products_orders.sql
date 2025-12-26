-- =============================================
-- WhatsAI Phase 3 Migration
-- Products, Orders, Bot Pause, Storage
-- =============================================

-- =============================================
-- PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    
    -- Product info
    name TEXT NOT NULL,
    description TEXT,
    price_fcfa INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'XOF',
    
    -- Categorization
    category TEXT,
    sku TEXT, -- Stock Keeping Unit
    
    -- Media
    image_url TEXT,
    
    -- Status
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT -1, -- -1 means unlimited
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ORDERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
    
    -- Customer info
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    
    -- Order details
    order_number TEXT UNIQUE, -- Human readable order number
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
    total_fcfa INTEGER NOT NULL DEFAULT 0,
    
    -- Delivery info
    delivery_address TEXT,
    delivery_notes TEXT,
    
    -- Internal notes
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- =============================================
-- ORDER ITEMS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    
    -- Item info (snapshot at time of order)
    product_name TEXT NOT NULL,
    product_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_fcfa INTEGER NOT NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- ADD BOT_PAUSED TO CONVERSATIONS
-- =============================================
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS bot_paused BOOLEAN DEFAULT false;

-- =============================================
-- ADD LEAD_NOTES TO CONVERSATIONS (if missing)
-- =============================================
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS lead_notes TEXT;

-- =============================================
-- ADD MODEL_USED TO MESSAGES (if missing)
-- =============================================
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS model_used TEXT;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_products_user_id ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_agent_id ON public.products(agent_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_conversation_id ON public.orders(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- =============================================
-- TRIGGERS
-- =============================================
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTION: Generate order number
-- =============================================
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    NEW.order_number := 'CMD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_order_number BEFORE INSERT ON public.orders
    FOR EACH ROW WHEN (NEW.order_number IS NULL)
    EXECUTE FUNCTION generate_order_number();

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY "Users can view own products" ON public.products
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own products" ON public.products
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own products" ON public.products
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own products" ON public.products
    FOR DELETE USING (user_id = auth.uid());

-- Orders policies
CREATE POLICY "Users can view own orders" ON public.orders
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can create own orders" ON public.orders
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own orders" ON public.orders
    FOR UPDATE USING (user_id = auth.uid());

-- Order items policies (based on order ownership)
CREATE POLICY "Users can view own order items" ON public.order_items
    FOR SELECT USING (
        order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can create own order items" ON public.order_items
    FOR INSERT WITH CHECK (
        order_id IN (SELECT id FROM public.orders WHERE user_id = auth.uid())
    );

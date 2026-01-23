-- =========================================================================
-- 🗄️ PRODUCTION SCHEMA (STRICT MATCH v4)
-- Date: 23 Jan 2026
-- Source: Live Database via pg_constraint extraction
-- Status: VERIFIED & ACTIVE (includes v2.19 Service Verticalization)
-- Tables: 21 | Constraints: 68 | Foreign Keys: 26
-- =========================================================================

-- 1. NOYAU UTILISATEURS & AGENTS
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    company TEXT,
    role TEXT DEFAULT 'user',
    plan TEXT DEFAULT 'free',
    currency TEXT DEFAULT 'USD',
    credits_balance INTEGER DEFAULT 100,
    credits_used_this_month INTEGER DEFAULT 0,
    timezone TEXT DEFAULT 'Africa/Abidjan',
    language TEXT DEFAULT 'fr',
    email_notifications BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
    CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'superadmin')),
    CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'starter', 'pro', 'business'))
);

CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    avatar_url TEXT,
    system_prompt TEXT NOT NULL,
    personality TEXT DEFAULT 'friendly',
    model TEXT DEFAULT 'gpt-4o-mini',
    temperature NUMERIC DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 500,
    use_emojis BOOLEAN DEFAULT true,
    response_delay_seconds INTEGER DEFAULT 2,
    language TEXT DEFAULT 'fr',
    welcome_message TEXT,
    
    -- WhatsApp
    whatsapp_connected BOOLEAN DEFAULT false,
    whatsapp_phone TEXT,
    whatsapp_session_id TEXT,
    whatsapp_session_data JSONB,
    whatsapp_status TEXT DEFAULT 'disconnected',
    whatsapp_qr_code TEXT,
    whatsapp_phone_number TEXT,
    
    -- Voice & Advanced
    enable_voice_responses BOOLEAN DEFAULT false,
    voice_id TEXT DEFAULT 'alloy',
    
    -- Business
    business_address TEXT,
    business_hours TEXT DEFAULT 'Lundi-Vendredi: 08:00 - 18:00\nSamedi: 09:00 - 13:00',
    contact_phone TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    
    -- Custom Behavior
    custom_rules TEXT,
    agent_tone TEXT DEFAULT 'friendly',
    agent_goal TEXT DEFAULT 'sales',
    
    -- Location
    latitude FLOAT8,
    longitude FLOAT8,
    
    -- Payments Config
    payment_mode TEXT DEFAULT 'cinetpay',
    mobile_money_orange TEXT,
    mobile_money_mtn TEXT,
    mobile_money_wave TEXT,
    custom_payment_methods JSONB DEFAULT '[]'::jsonb,
    escalation_phone TEXT,
    
    -- Stats
    is_active BOOLEAN DEFAULT true,
    total_conversations INTEGER DEFAULT 0,
    total_messages INTEGER DEFAULT 0,
    total_leads INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT agents_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT agents_personality_check CHECK (personality IN ('professional', 'friendly', 'casual', 'formal'))
);

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
    session_id TEXT NOT NULL, 
    key_id TEXT NOT NULL,
    data TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    PRIMARY KEY (session_id, key_id)
);

-- 2. MESSAGERIE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_name TEXT,
    contact_push_name TEXT,
    contact_avatar_url TEXT,
    contact_jid TEXT,
    
    status TEXT DEFAULT 'active',
    is_starred BOOLEAN DEFAULT false,
    bot_paused BOOLEAN DEFAULT false,
    
    lead_status TEXT,
    lead_score INTEGER DEFAULT 0,
    lead_notes TEXT,
    tags TEXT[],
    
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_role TEXT,
    unread_count INTEGER DEFAULT 0,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT conversations_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT conversations_status_check CHECK (status IN ('active', 'closed', 'escalated', 'spam')),
    CONSTRAINT conversations_lead_status_check CHECK (lead_status IN ('new', 'qualified', 'contacted', 'negotiation', 'converted', 'lost'))
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    whatsapp_message_id TEXT,
    message_type TEXT DEFAULT 'text',
    media_url TEXT,
    media_mime_type TEXT,
    
    tokens_used INTEGER DEFAULT 0,
    response_time_ms INTEGER,
    model_used TEXT,
    status TEXT DEFAULT 'sent',
    error_message TEXT,
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT messages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT messages_role_check CHECK (role IN ('user', 'assistant', 'system')),
    CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'audio', 'video', 'document', 'location', 'contact', 'sticker')),
    CONSTRAINT messages_status_check CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed', 'received'))
);

CREATE TABLE IF NOT EXISTS public.outbound_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    recipient_phone TEXT NOT NULL,
    message_content TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT outbound_messages_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE IF NOT EXISTS public.broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID,
    message TEXT NOT NULL,
    recipients_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'sent',
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT broadcasts_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 3. COMMERCE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID,
    name TEXT NOT NULL,
    description TEXT,
    price_fcfa INTEGER NOT NULL DEFAULT 0,
    currency TEXT DEFAULT 'XOF',
    
    category TEXT,
    sku TEXT,
    image_url TEXT,
    images TEXT[] DEFAULT '{}'::text[],
    is_available BOOLEAN DEFAULT true,
    stock_quantity INTEGER DEFAULT -1,
    product_type TEXT DEFAULT 'product',
    
    variants JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    ai_instructions TEXT,
    short_pitch TEXT,
    marketing_tags JSONB DEFAULT '[]'::jsonb,
    lead_fields JSONB DEFAULT '[]'::jsonb,
    related_product_ids JSONB DEFAULT '[]'::jsonb,
    
    -- v2.19: Service Verticalization
    service_subtype TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT products_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT products_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    CONSTRAINT check_service_subtype CHECK (service_subtype IN (
        'hotel', 'residence', 'restaurant', 'formation', 'event',
        'coiffeur', 'medecin', 'coaching', 'prestation', 'rental', 'other'
    ))
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    agent_id UUID,
    conversation_id UUID,
    
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    order_number TEXT UNIQUE,
    status TEXT DEFAULT 'pending', 
    total_fcfa INTEGER NOT NULL DEFAULT 0,
    
    delivery_address TEXT,
    delivery_notes TEXT,
    notes TEXT,
    
    payment_method TEXT DEFAULT 'online',
    transaction_id TEXT,
    payment_verification_status TEXT,
    payment_screenshot_url TEXT,
    verified_at TIMESTAMPTZ,
    verified_by UUID,
    
    confirmed_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT orders_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE SET NULL,
    CONSTRAINT orders_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL,
    CONSTRAINT orders_status_check CHECK (status IN ('pending', 'paid', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'pending_delivery', 'refunded'))
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL,
    product_id UUID,
    product_name TEXT NOT NULL,
    product_description TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_fcfa INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    user_id UUID,
    conversation_id UUID,
    service_id UUID,
    
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    
    booking_type TEXT NOT NULL,
    service_name TEXT,
    status TEXT DEFAULT 'confirmed',
    
    start_time TIMESTAMPTZ NOT NULL,
    preferred_date DATE,
    preferred_time TIME,
    party_size INTEGER DEFAULT 1,
    location TEXT,
    notes TEXT,
    price_fcfa INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT bookings_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id),
    CONSTRAINT bookings_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES conversations(id),
    CONSTRAINT bookings_service_id_fkey FOREIGN KEY (service_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS public.future_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    customer_phone TEXT NOT NULL,
    booking_type TEXT NOT NULL,
    status TEXT DEFAULT 'confirmed',
    start_time TIMESTAMPTZ NOT NULL,
    party_size INTEGER DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT future_bookings_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
);

-- 4. PAIEMENTS & SYSTEME
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    subscription_id UUID,
    amount_fcfa INTEGER NOT NULL,
    currency TEXT DEFAULT 'XOF',
    payment_type TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'pending',
    
    payment_provider TEXT DEFAULT 'cinetpay',
    provider_transaction_id TEXT,
    provider_payment_url TEXT,
    provider_response JSONB,
    
    credits_purchased INTEGER,
    customer_phone TEXT,
    customer_email TEXT,
    
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
    CONSTRAINT payments_payment_type_check CHECK (payment_type IN ('subscription', 'credits', 'one_time')),
    CONSTRAINT payments_status_check CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'))
);

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    price_fcfa INTEGER NOT NULL DEFAULT 0,
    credits_included INTEGER NOT NULL DEFAULT 100,
    features JSONB DEFAULT '[]'::jsonb,
    billing_cycle TEXT DEFAULT 'monthly',
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    max_agents INTEGER DEFAULT 1,
    max_whatsapp_numbers INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT subscription_plans_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly'))
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    plan TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    credits_included INTEGER NOT NULL,
    price_fcfa INTEGER NOT NULL,
    billing_cycle TEXT DEFAULT 'monthly',
    
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    payment_provider TEXT DEFAULT 'cinetpay',
    provider_subscription_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'cancelled', 'expired', 'past_due', 'trialing')),
    CONSTRAINT subscriptions_plan_check CHECK (plan IN ('starter', 'pro', 'business')),
    CONSTRAINT subscriptions_billing_cycle_check CHECK (billing_cycle IN ('monthly', 'yearly'))
);

CREATE TABLE IF NOT EXISTS public.credit_packs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    price INTEGER NOT NULL,
    savings INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL,
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_type TEXT DEFAULT 'text',
    metadata JSONB,
    embedding VECTOR(1536),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT knowledge_base_agent_id_fkey FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE,
    CONSTRAINT knowledge_base_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
    CONSTRAINT knowledge_base_content_type_check CHECK (content_type IN ('text', 'faq', 'document', 'url', 'product'))
);

CREATE TABLE IF NOT EXISTS public.admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT admin_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    -- STRICT CONSTRAINTS
    CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id)
);

CREATE TABLE IF NOT EXISTS public.feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- END OF STRICT SCHEMA v4
-- Generated from Live Database on 23 Jan 2026

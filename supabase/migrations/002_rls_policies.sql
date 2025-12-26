-- =============================================
-- WhatsAI Row Level Security (RLS) Policies
-- Version: 1.0.0
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES POLICIES
-- =============================================

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- =============================================
-- AGENTS POLICIES
-- =============================================

-- Users can view their own agents
CREATE POLICY "Users can view own agents"
    ON public.agents FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create agents
CREATE POLICY "Users can create agents"
    ON public.agents FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own agents
CREATE POLICY "Users can update own agents"
    ON public.agents FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own agents
CREATE POLICY "Users can delete own agents"
    ON public.agents FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- WHATSAPP_SESSIONS POLICIES
-- =============================================

-- Users can view their own sessions
CREATE POLICY "Users can view own whatsapp sessions"
    ON public.whatsapp_sessions FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create sessions
CREATE POLICY "Users can create whatsapp sessions"
    ON public.whatsapp_sessions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions
CREATE POLICY "Users can update own whatsapp sessions"
    ON public.whatsapp_sessions FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own sessions
CREATE POLICY "Users can delete own whatsapp sessions"
    ON public.whatsapp_sessions FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- CONVERSATIONS POLICIES
-- =============================================

-- Users can view their own conversations
CREATE POLICY "Users can view own conversations"
    ON public.conversations FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create conversations (via agents they own)
CREATE POLICY "Users can create conversations"
    ON public.conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own conversations
CREATE POLICY "Users can update own conversations"
    ON public.conversations FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own conversations
CREATE POLICY "Users can delete own conversations"
    ON public.conversations FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- MESSAGES POLICIES
-- =============================================

-- Users can view messages from their conversations
CREATE POLICY "Users can view messages from own conversations"
    ON public.messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in own conversations"
    ON public.messages FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id
            AND c.user_id = auth.uid()
        )
    );

-- =============================================
-- KNOWLEDGE_BASE POLICIES
-- =============================================

-- Users can view their own knowledge base entries
CREATE POLICY "Users can view own knowledge base"
    ON public.knowledge_base FOR SELECT
    USING (auth.uid() = user_id);

-- Users can create knowledge base entries
CREATE POLICY "Users can create knowledge base entries"
    ON public.knowledge_base FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own knowledge base entries
CREATE POLICY "Users can update own knowledge base"
    ON public.knowledge_base FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own knowledge base entries
CREATE POLICY "Users can delete own knowledge base"
    ON public.knowledge_base FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- SUBSCRIPTIONS POLICIES
-- =============================================

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
    ON public.subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- =============================================
-- PAYMENTS POLICIES
-- =============================================

-- Users can view their own payments
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (auth.uid() = user_id);

-- =============================================
-- SERVICE ROLE POLICIES (for backend/webhooks)
-- =============================================
-- Note: The service role key bypasses RLS by default
-- These are handled by the SUPABASE_SERVICE_ROLE_KEY

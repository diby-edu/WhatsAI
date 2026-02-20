-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Phase 4 — Audit Trail & Enhanced Analytics
-- ═══════════════════════════════════════════════════════════════

-- 1. Mettre à jour les rôles autorisés (Ajout de 'support')
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin', 'support'));

-- 2. Création de la table Audit Trail
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.profiles(id),
    
    action_type TEXT NOT NULL, -- 'ban', 'unban', 'change_plan', 'set_credits', 'payout_created', etc.
    target_id UUID,            -- ID de l'utilisateur or ressource impactée
    target_type TEXT,          -- 'profile', 'agent', 'payout', etc.
    
    metadata JSONB DEFAULT '{}', -- Détails (ex: { old_plan: 'free', new_plan: 'pro' })
    ip_address TEXT,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la performance des logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON public.admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target_id ON public.admin_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.admin_audit_logs(created_at DESC);

-- 3. Vue Analytics Temporelle (Revenus Plateforme vs Marchands)
DROP VIEW IF EXISTS view_analytics_revenue_time_series;
CREATE OR REPLACE VIEW view_analytics_revenue_time_series AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    SUM(CASE WHEN payment_type IN ('subscription', 'credits') THEN amount_fcfa ELSE 0 END) as platform_revenue,
    SUM(CASE WHEN payment_type = 'one_time' THEN amount_fcfa ELSE 0 END) as merchant_revenue,
    COUNT(*) as transaction_count
FROM payments
WHERE status = 'completed'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 ASC;

-- 4. Vue Analytics Croissance Utilisateurs
DROP VIEW IF EXISTS view_analytics_user_growth;
CREATE OR REPLACE VIEW view_analytics_user_growth AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as new_users
FROM profiles
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1
ORDER BY 1 ASC;

-- Permissions
GRANT ALL ON public.admin_audit_logs TO service_role;
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT SELECT ON view_analytics_revenue_time_series TO authenticated;
GRANT SELECT ON view_analytics_user_growth TO authenticated;

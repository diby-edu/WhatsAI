-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Vues de Monitoring Admin & Analytics
-- ═══════════════════════════════════════════════════════════════

-- 1. Ajouter la colonne manquante si besoin
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ;

-- 2. Supprimer les vues existantes pour éviter les erreurs de changement de colonnes
DROP VIEW IF EXISTS view_admin_alerts;
DROP VIEW IF EXISTS view_analytics_payments;

-- 3. Vue des Alertes Critiques (Agents déco, Crédits bas)
CREATE OR REPLACE VIEW view_admin_alerts AS
SELECT 
    'agent_disconnect' as type,
    id as resource_id,
    name as label,
    'WhatsApp déconnecté' as message,
    'critical' as severity,
    EXTRACT(DAY FROM (NOW() - COALESCE(last_message_at, updated_at))) as days_since_active
FROM agents
WHERE whatsapp_connected = false

UNION ALL

SELECT 
    'low_credits' as type,
    id as resource_id,
    full_name as label,
    'Solde inférieur à 10 crédits' as message,
    'warning' as severity,
    0 as days_since_active
FROM profiles
WHERE credits_balance < 10

UNION ALL

SELECT
    'high_merchant_balance' as type,
    id as resource_id,
    full_name as label,
    'Solde à reverser élevé (> 50k)' as message,
    'warning' as severity,
    0 as days_since_active
FROM profiles
-- Logic: amount from one_time payments - payouts
WHERE id IN (
    SELECT user_id 
    FROM (
        SELECT user_id, SUM(amount_fcfa) as total_collected
        FROM payments 
        WHERE status = 'completed' AND payment_type = 'one_time'
        GROUP BY user_id
    ) p
    LEFT JOIN (
        SELECT user_id, SUM(net_amount + commission_amount) as total_paid
        FROM payouts
        WHERE status = 'completed'
        GROUP BY user_id
    ) pay USING (user_id)
    WHERE (COALESCE(p.total_collected, 0) - COALESCE(pay.total_paid, 0)) > 50000
);

-- 4. Vue Analytics des Paiements (Global)
CREATE OR REPLACE VIEW view_analytics_payments AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    status,
    COUNT(*) as count,
    SUM(amount_fcfa) as total_revenue
FROM payments
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY 1, 2
ORDER BY 1 DESC;

-- 3. Fonction pour stats messages 7 jours
CREATE OR REPLACE FUNCTION get_message_stats_last_7_days()
RETURNS TABLE (day DATE, total_messages BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(created_at) as day,
        COUNT(*) as total_messages
    FROM messages
    WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(created_at)
    ORDER BY day ASC;
END;
$$ LANGUAGE plpgsql;

-- Permissions
GRANT SELECT ON view_admin_alerts TO authenticated;
GRANT SELECT ON view_analytics_payments TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_stats_last_7_days() TO authenticated;

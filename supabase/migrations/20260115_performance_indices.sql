-- ═══════════════════════════════════════════════════════════════
-- MIGRATION : Optimisation des Performances (Indexation)
-- ═══════════════════════════════════════════════════════════════

-- 1. Index sur les messages (Recherche rapide par conversation et date)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at 
ON messages(conversation_id, created_at DESC);

-- 2. Index sur les paiements (Analytics et Dashboard)
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status 
ON payments(user_id, status);

CREATE INDEX IF NOT EXISTS idx_payments_created_at 
ON payments(created_at DESC);

-- 3. Index sur les conversations (Access par agent et dernier message)
CREATE INDEX IF NOT EXISTS idx_conversations_agent_id_updated_at 
ON conversations(agent_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_contact_phone 
ON conversations(contact_phone);

-- 4. Index sur les agents (Performance login/status)
CREATE INDEX IF NOT EXISTS idx_agents_user_id 
ON agents(user_id);

CREATE INDEX IF NOT EXISTS idx_agents_whatsapp_connected 
ON agents(whatsapp_connected) WHERE whatsapp_connected = true;

-- 5. Statistiques
ANALYZE messages;
ANALYZE conversations;
ANALYZE payments;
ANALYZE profiles;

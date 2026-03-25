-- Migration : champs Agent Support Client
-- Phase 2.2 du plan d'implémentation

-- Contexte supplémentaire injecté dans le prompt Support Client
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agent_context TEXT;

-- Numéro d'escalade (déjà utilisé en runtime dans message.js, alignement schéma)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS escalation_phone TEXT;

-- Champs paiement (déjà utilisés dans prompt-builder et tool-orders, alignement schéma)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS payment_mode TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS mobile_money_orange TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS mobile_money_mtn TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS mobile_money_wave TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS custom_payment_methods JSONB;

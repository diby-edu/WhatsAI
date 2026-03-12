-- =============================================
-- Fix: La colonne combinations n'existait pas dans products,
-- causant une erreur PGRST204 dans le SELECT de message-handler.ts
-- et vidant entièrement le contexte produit de l'agent IA.
-- L'agent hallucine alors prix, descriptions et variantes.
-- =============================================

ALTER TABLE products
ADD COLUMN IF NOT EXISTS combinations JSONB DEFAULT NULL;

-- Frais de livraison configurables pour les agents "Produit Physique"
-- delivery_fee_mode: 'none' (defaut, comportement actuel inchange) | 'free' | 'zones'
-- delivery_zones: structure JSON des communes/quartiers/hors-Abidjan/international
ALTER TABLE agents ADD COLUMN IF NOT EXISTS delivery_fee_mode text NOT NULL DEFAULT 'none';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS delivery_zones jsonb;

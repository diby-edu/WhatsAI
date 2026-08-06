-- ═══════════════════════════════════════════════════════════════
-- Migration : Ajoute leads.lead_address
-- Nouveau champ standard "Adresse de livraison" pour la collecte de
-- leads — distinct de lead_location (quartier/ville, plus vague),
-- utile notamment pour les agents produits physiques en mode lead_only.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_address text;

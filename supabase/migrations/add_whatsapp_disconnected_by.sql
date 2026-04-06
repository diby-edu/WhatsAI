-- Ajoute la colonne qui distingue déconnexion volontaire (user) vs technique (system)
-- Valeurs : 'user' | 'system' | NULL (quand connecté ou jamais connecté)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS whatsapp_disconnected_by text;

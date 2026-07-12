-- CSEC-4 : le bucket verification-images (justificatifs de paiement Mobile
-- Money) était public → chemins énumérables, PII exposée sans authentification.
-- Passage en privé : l'accès se fait désormais exclusivement via des URLs
-- signées à durée de vie courte, générées côté serveur (service role) par
-- /api/orders/[id]/screenshot-url après vérification de propriété de la commande.

UPDATE storage.buckets SET public = false WHERE id = 'verification-images';

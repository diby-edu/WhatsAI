-- Mode de récupération du lead : retrait en boutique ou livraison.
--
-- Le moteur d'extraction le capte de façon fiable depuis les mots du client
-- (lead-state.service.js#detectFulfillmentMode), mais la table n'avait aucune colonne
-- pour l'accueillir. Il était donc glissé dans `interest`, un champ de texte libre que
-- le tableau de bord découpe en puces — « retrait en boutique » s'y affichait comme un
-- article commandé.
--
-- Colonne nullable, sans valeur par défaut : les leads existants restent inchangés.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS fulfillment_mode text;

COMMENT ON COLUMN public.leads.fulfillment_mode IS
  'pickup = retrait en boutique, delivery = livraison, NULL = non déterminé';

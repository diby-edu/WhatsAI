# WazzapAI x Shopify - Phase 2 (App officielle)

## But
Passer d'une integration manuelle a une integration produit:
- onboarding propre,
- scaling multi-boutiques,
- support reduit,
- alignement Shopify App standards.

---

## Ce que la phase 2 doit apporter
- Bouton "Connect Shopify" dans WazzapAI.
- OAuth Shopify (installation app).
- Creation auto des subscriptions webhook.
- Synchronisation des donnees utiles (orders/products/customers selon scopes).
- Monitoring central des webhooks par shop.
- UX simple pour client final.

---

## Choix d'architecture

## Option A - App custom/private (recommandee au debut)
- Plus rapide a livrer.
- Parfait pour premiers clients pilotes.
- Pas besoin de review App Store au debut.

## Option B - App publique Shopify App Store
- Plus scalable commercialement.
- Plus lourde (review, conformité, policy, support).
- A lancer apres validation metier et technique de l'option A.

Recommandation:
1. Construire d'abord App custom robuste.
2. Evoluer vers App publique ensuite.

---

## Composants techniques obligatoires

## 1) OAuth Shopify
- ecran connect: redirection vers Shopify install flow.
- callback OAuth: echange code -> access token.
- stockage securise token par boutique.

## 2) Webhook subscriptions (GraphQL Admin API)
- creer/mettre a jour automatiquement:
  - `orders/create` (minimum)
  - optionnels: `orders/updated`, `orders/paid`, etc.
- endpoint cible: URL WazzapAI dediee shop/app.

## 3) Verification webhook
- HMAC Shopify (`X-Shopify-Hmac-Sha256`) obligatoire sur livraison reelle.
- tolerance controlee pour certains probes de config.

## 4) Idempotence et queue
- dedoublonnage par event id / webhook id / hash payload.
- publication dans queue outbound WhatsApp.

## 5) Observabilite
- tableaux de bord:
  - taux succes webhooks
  - latence
  - erreurs par boutique
  - retries / duplicates

---

## Donnees minimum a stocker
- `shop_domain`
- `shop_id` (si dispo)
- `access_token` chiffre
- `installed_at`, `uninstalled_at`
- `scopes`
- `webhook_subscriptions` (topic, id, status)
- `last_webhook_at`, `last_webhook_status`, `last_webhook_error`

---

## Scopes Shopify (a valider selon use case)
- minimum commande:
  - `read_orders`
- si sync catalogue:
  - `read_products`
- si besoin client:
  - `read_customers`

Toujours demander le strict necessaire.

---

## Parcours utilisateur cible (phase 2)

1. Client clique "Connect Shopify" dans WazzapAI.
2. OAuth Shopify.
3. WazzapAI confirme "Store connecte".
4. WazzapAI cree les webhooks requis automatiquement.
5. Client passe une commande test.
6. WazzapAI affiche "Webhook recu" puis "Message WhatsApp envoye".

Temps cible onboarding:
- moins de 3 minutes.

---

## Plan d'execution recommande

## Sprint 1 - Fondations
- OAuth install/uninstall.
- stockage token shop.
- modeles DB shop integration.

## Sprint 2 - Webhooks techniques
- gestion subscriptions webhook via GraphQL.
- endpoint webhook multi-shop.
- verification signature + idempotence.

## Sprint 3 - Flux metier
- mapping order_created -> message WazzapAI.
- queue outbound + traces.
- interface monitoring basique.

## Sprint 4 - Durcissement
- retries, alerting, quotas.
- tests charge/chaos.
- guide runbook support.

---

## Risques principaux et mitigation

## Risque 1 - Duplicates/ordering
- mitigation: idempotence stricte + logique tolerante au desordre.

## Risque 2 - Erreurs signature
- mitigation: logs enrichis (topic, event id, shop domain, content-type).

## Risque 3 - App Store review (si public)
- mitigation: check-list conformité Shopify en amont.

## Risque 4 - Support client elevé
- mitigation: onboarding wizard + auto-diagnostics.

---

## Definition of Done (phase 2)
- connect OAuth fonctionnel sur boutique test.
- subscription auto `orders/create` operationnelle.
- commande reelle Shopify -> WhatsApp sent.
- logs exploitables en cas d'erreur.
- pas de doublon au rejeu webhook.
- onboarding documente pour support/client.

---

## Frontiere phase 1 vs phase 2

Phase 1:
- manuel, rapide, deja vendable.

Phase 2:
- produit industrialise, scalable, meilleur UX, moins de support.

Conclusion pratique:
- garder phase 1 active en production,
- construire phase 2 en parallele sans bloquer le business.


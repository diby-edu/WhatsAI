# Audit Final - Parcours Commande

Date: 2026-03-16

## Verdict

Le parcours commande est globalement sain sur la stack WhatsApp JS de production.

Etat final:
- OK: collecte des informations client
- OK: téléphone avec indicatif pays obligatoire côté backend
- OK: variantes fixes requises avant `create_order`
- OK: suppléments optionnels non bloquants
- OK: prix par combinaison
- OK: combinaison désactivée bloquée
- OK: stock par combinaison contrôlé
- OK: création atomique `orders` + `order_items`
- OK: sortie paiement `cod` / `mobile_money_direct` / `cinetpay`
- OK: webhook CinetPay fail-closed

## Ce qui est sécurisé

### 1. Téléphone client

Le backend n'invente plus de pays par défaut.

Formats acceptés:
- `+2250701020304`
- `002250701020304`
- `2250701020304`

Formats refusés:
- `0701020304`
- `771234567`
- `abc`
- `+225`

Fichiers:
- `src/lib/whatsapp/ai/tools/tool-helpers.js`
- `src/lib/whatsapp/ai/tools/tool-orders.js`
- `src/lib/whatsapp/ai/tools/tool-bookings.js`
- `src/lib/whatsapp/utils/format.js`

### 2. Guidance IA

Le schema des tools demande explicitement un numéro avec indicatif pays.

Fichier:
- `src/lib/whatsapp/ai/tools/definitions.js`

### 3. Variantes produit

Le pre-check IA:
- exige les variantes fixes
- ne bloque plus sur les suppléments optionnels

Fichier:
- `src/lib/whatsapp/ai/generator.js`

### 4. Prix des produits

Le moteur de prix:
- utilise le prix de combinaison si disponible
- bloque une combinaison désactivée
- bloque une combinaison avec stock insuffisant
- continue à gérer les suppléments additifs

Fichier:
- `src/lib/whatsapp/ai/tools/pricing-logic.js`

### 5. Stock

Lors de la commande:
- contrôle du stock produit global
- contrôle du stock de la combinaison exacte
- décrément du stock global
- décrément du stock de la combinaison
- bascule `available=false` si le stock combinaison atteint `0`

Fichier:
- `src/lib/whatsapp/ai/tools/tool-orders.js`

### 6. Création commande

La commande et ses articles sont créés dans une seule transaction SQL via RPC.

Fichiers:
- `src/lib/whatsapp/ai/tools/tool-orders.js`
- `supabase/migrations/20260316_create_order_atomic.sql`

### 7. Paiement

Modes gérés:
- `cod`
- `mobile_money_direct`
- `cinetpay`

Fichiers:
- `src/lib/whatsapp/ai/tools/tool-orders.js`
- `src/app/api/public/orders/[orderId]/pay/route.ts`
- `src/app/api/payments/cinetpay/webhook/route.ts`

## Comportement vérifié avec 3 cas variantes

### Cas 1 - Produit simple

Produit:
- Casque Bluetooth

Résultat:
- prix de base appliqué
- aucune variante requise
- commande autorisée

### Cas 2 - Combinaison valide

Produit:
- T-Shirt Premium

Choix:
- Rouge + L

Résultat:
- prix combinaison appliqué
- commande autorisée

### Cas 3 - Combinaison non vendable

Produit:
- T-Shirt Premium

Choix:
- Bleu + L désactivée

Résultat:
- commande bloquée
- message explicite "combinaison non disponible"

### Cas 4 - Stock insuffisant sur combinaison

Produit:
- T-Shirt Premium

Choix:
- Rouge + L
- stock combinaison = 1
- quantité demandée = 2

Résultat:
- commande bloquée
- message explicite de stock insuffisant

### Cas 5 - Supplément optionnel non choisi

Produit:
- Pizza Gourmet

Choix:
- Taille = Grande
- aucun supplément

Résultat:
- commande autorisée
- le supplément n'est pas exigé artificiellement

## Points encore non critiques

- Le retry outbound reste simple: pas encore de `retry_count` / `next_retry_at`
- Le parcours a été vérifié par lecture de code et tests ciblés locaux, pas par transaction CinetPay réelle dans cet audit

## Conclusion courte

Le parcours commande est maintenant cohérent sur les points métier critiques:
- téléphone
- variantes
- prix
- combinaisons
- stock
- paiement

Le sujet restant relève surtout de la robustesse infra, pas d'un bug métier du parcours commande.

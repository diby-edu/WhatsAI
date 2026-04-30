# WazzapAI x WooCommerce - Moyen Terme (Plugin Woo officiel)

## Objectif
Remplacer la dependance au snippet manuel par un plugin WooCommerce officiel WazzapAI, afin d'offrir une integration "propre", simple pour le marchand, et scalable pour le support.

Ce document decrit:
- Pourquoi construire le plugin.
- Ce que le plugin doit faire.
- Un plan d'implementation progressif sans casser la production.

---

## Pourquoi passer au plugin

Avec la solution snippet:
- Chaque marchand doit installer/configurer lui-meme.
- Erreurs frequentes de copier-coller.
- Support plus couteux.

Avec un plugin officiel:
- Setup guide par wizard.
- Moins d'erreurs humaines.
- Support centralise.
- Experience client beaucoup plus fiable.

---

## Vision produit plugin (v1)

## Principe
Le plugin connecte Woo -> WazzapAI sans n8n:
1. Le marchand colle URL incoming + secret (ou token + secret).
2. Le plugin configure/valide le webhook Woo.
3. Le plugin normalise et valide le numero checkout.
4. Les commandes declenchent des webhooks fiables vers WazzapAI.

## Cible v1
- Topic principal: `order.created`
- Optionnels v1.1: `order.updated`, `order.failed`

---

## Architecture recommandee

## Cote Woo plugin
- Ecran d'admin `WooCommerce > Settings > WazzapAI`.
- Stockage des settings:
  - `incoming_url` (ou `webhook_token`)
  - `signing_secret`
  - `enabled_events[]`
  - `phone_policy` (required + normalization mode)
- Hook checkout:
  - rendre `billing_phone` requis
  - normaliser en E.164
  - valider le format final
- Hook events Woo:
  - envoi payload standardise vers URL incoming
  - signature HMAC Woo standard

## Cote WazzapAI (deja existant)
- Endpoint incoming:
  - `/api/public/v1/incoming/[token]`
- Verification signature.
- Anti-doublon.
- Queue outbound.
- Logs techniques.

---

## UX admin plugin (wizard)

## Ecran 1 - Connexion
- Champ `URL WazzapAI incoming`.
- Champ `Secret webhook`.
- Bouton `Tester la connexion`.
- Resultat:
  - `Connexion OK` ou message detaille.

## Ecran 2 - Evenements
- Cases a cocher:
  - `Order created` (obligatoire)
  - `Order updated` (optionnel)
  - `Order failed` (optionnel)
- Bouton `Appliquer`.

## Ecran 3 - Telephone checkout
- Toggle `Rendre telephone obligatoire`.
- Toggle `Normaliser automatiquement en format international`.
- Champ `Pays par defaut` (fallback).

## Ecran 4 - Validation finale
- Checklist verte/rouge:
  - webhook actif
  - secret present
  - test event recu
  - test WhatsApp envoye

---

## Specifications fonctionnelles detaillees

## 1) Politique telephone
- `billing_phone` requis.
- Normalisation:
  - deja `+...` => conserver.
  - `00...` => convertir en `+...`.
  - sans `+` mais commence deja par indicatif pays => prefixer seulement `+`.
  - sinon prefixer indicatif pays deduit de `billing_country`.
- Validation stricte:
  - regex E.164 `^\+\d{8,15}$`.
- Si invalide:
  - bloquer checkout avec message clair.

## 2) Envoi webhook
- Utiliser payload Woo natif + headers Woo standards.
- Toujours inclure:
  - `X-WC-Webhook-Topic`
  - `X-WC-Webhook-Delivery-ID`
  - `X-WC-Webhook-Signature`
- Timeout + retry local plugin (leger) en cas d'echec reseau.

## 3) Observabilite plugin
- Ecran logs plugin (10-50 derniers envois):
  - timestamp
  - topic
  - status HTTP
  - delivery id
  - extrait erreur
- Bouton `Retester`.

---

## Plan d'implementation prudent (sans risque prod)

## Phase 0 - Cadrage (1-2 jours)
- Verrouiller spec v1.
- Definir versionning plugin.
- Definir messages d'erreur UX.

## Phase 1 - MVP plugin (3-5 jours)
- Settings page.
- Validation URL + secret.
- Hook `order.created`.
- Politique telephone obligatoire + normalisation.
- Test bout-en-bout sur staging.

## Phase 2 - Robustesse (2-3 jours)
- Ajout `order.updated` et `order.failed`.
- Logs plugin + retries basiques.
- Test compatibilite themes/checkout blocks.

## Phase 3 - Publication interne (1-2 jours)
- Packaging ZIP plugin.
- Guide installation client.
- Script support standard.

---

## Compatibilite et contraintes

## Compatibilite minimum
- WordPress 6.x
- WooCommerce 8.x+
- PHP 8.1+

## Contraintes connues
- Checkout custom de certains themes peut override certains champs.
- Il faut tester mode classique + checkout blocks.

---

## Securite

## Regles minimales
- Ne jamais afficher secret complet sans action explicite.
- Masquer secret en admin (icone oeil pour reveler temporairement).
- Sanitizer strict de toutes entrees admin plugin.
- Nonce + capability checks (`manage_woocommerce`) pour les actions admin.

## Signature
- Toujours utiliser signature HMAC Woo standard.
- Ne pas inventer de format non standard cote plugin v1.

---

## Definition of Done (DoD)

Le plugin v1 est "pret" si:
1. Un marchand configure URL + secret en moins de 3 minutes.
2. Un `order.created` reel envoie bien un WhatsApp.
3. Telephone invalide est bloque au checkout.
4. Les erreurs sont visibles dans un ecran logs simple.
5. Aucune regression sur flux Woo standard.

---

## Exemple scenario reel

1. Marchand installe plugin WazzapAI.
2. Il colle URL incoming `pwk_...` et secret `wsec_...`.
3. Il active `Order created`.
4. Client passe commande #18 avec telephone billing.
5. Plugin envoie webhook signe.
6. WazzapAI accepte, queue message, envoie WhatsApp.
7. Marchand voit status "sent" cote WazzapAI.

---

## Recommandation finale

Court terme:
- garder doc + snippet pour operer immediatement.

Moyen terme:
- lancer plugin Woo officiel WazzapAI v1.

Ce combo reduit fortement les erreurs d'integration et le temps support, tout en gardant la production stable.


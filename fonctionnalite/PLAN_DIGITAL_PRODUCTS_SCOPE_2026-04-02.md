# PLAN — Produits Numériques & Product Scope
Date : 2026-04-02

---

## 1. Contexte

Le système actuel détecte le type de produit à la volée (regex sur noms, `product_type` en runtime).
Cela crée des ambiguïtés et des collectes de champs inutiles ou manquants.

Ce plan introduit un champ `product_scope` au niveau de l'agent pour déclarer en avance ce que l'agent vend.

---

## 2. Champ `product_scope` sur la table `agents`

### Valeurs possibles

| Valeur | Description |
|--------|-------------|
| `digital` | L'agent vend uniquement des produits numériques (ebooks, licences, fichiers…) |
| `physical` | L'agent vend uniquement des produits physiques (vêtements, alimentaire…) |
| `service` | L'agent vend uniquement des prestations/réservations (sans moteur restaurant) |
| `restaurant` | Moteur restaurant dédié (déjà implémenté) |
| `mixed` | L'agent vend plusieurs types : physique + numérique, physique + service, etc. |

### Valeur par défaut
`physical` (comportement actuel, pas de régression)

---

## 3. Impact sur la collecte des infos client (checkout)

### Agent `digital`
- Email → **toujours requis**
- Adresse de livraison → **jamais demandée**
- Mode de paiement → **toujours `online`**, pas de question posée au client
- Champs collectés : nom, téléphone, email, notes

### Agent `physical`
- Email → **jamais demandé**
- Adresse de livraison → **toujours requise** (sauf si mode retrait)
- Mode de paiement → **choix proposé** (en ligne, à la livraison, etc.)
- Champs collectés : nom, téléphone, adresse, mode de paiement, notes

### Agent `mixed`
- Le bot regarde ce qui est dans le panier :
  - Si un item numérique est présent → email requis
  - Si un item physique est présent → adresse requise
  - Mode de paiement → proposé selon les items
- Détection basée sur `product_type` de chaque produit dans le panier

### Agent `service`
- Email → non requis par défaut
- Adresse → non requise
- Champs collectés : nom, téléphone, date/heure, notes

### Agent `restaurant`
- Géré par le moteur restaurant dédié (voir PLAN_RESTAURANT_ENGINE_2026-03-25.md)

---

## 4. Impact sur le dashboard de création de produits

### Agent `digital`
- Seul `product_type = 'digital'` disponible
- Section clés de licence et contenu fixe toujours visible
- Champs adresse/livraison masqués

### Agent `physical`
- Seuls `product_type = 'product'` disponible
- Section clés/contenu numérique masquée

### Agent `mixed`
- Tous les types disponibles

---

## 5. Impact sur le workflow IA

Le `product_scope` est passé au générateur IA et au prompt builder.

| Scope | Workflow utilisé |
|-------|-----------------|
| `digital` | `workflow-type-digital.js` systématiquement |
| `physical` | `workflow-type-physical.js` (ou comportement actuel) |
| `mixed` | Détection dynamique par panier (comportement actuel amélioré) |
| `service` | `workflow-type-service.js` |
| `restaurant` | `workflow-service-restaurant.js` |

Plus de détection fragile par regex sur les noms de produits.

---

## 6. Onboarding — Numéro de téléphone support

À l'onboarding après inscription, le marchand saisit son numéro de téléphone.

### Règles
- Ce numéro est le **numéro personnel/support du marchand**
- Il sert à contacter le marchand (support plateforme, relances, incidents)
- **Il n'est pas connecté à un agent WhatsApp**
- Aucune validation n'est faite pour vérifier s'il est déjà utilisé sur un agent (le marchand peut temporairement tester avec ce numéro puis le remplacer)

### Libellé dans le formulaire
```
Votre numéro de téléphone
Ce numéro sert à vous contacter (support, informations importantes).
Il ne sera pas connecté à un agent WhatsApp.
Format : indicatif pays obligatoire (ex : +225 07 00 00 00)
```

---

## 7. Email d'envoi des produits numériques (décision prise)

- Livraison du produit numérique → **WhatsApp uniquement** (pas d'envoi email)
- L'email client est collecté mais **non utilisé pour la livraison** en V1
- Envoi email → hors scope V1

---

## 8. Vérification numéro à l'inscription (décision prise)

- Pas de vérification OTP SMS ou WhatsApp à l'inscription
- La vérification naturelle se fait lors du premier échange WhatsApp avec un agent
- Hors scope V1

---

## 9. Migrations SQL nécessaires

```sql
-- Ajout product_scope sur agents
ALTER TABLE agents
ADD COLUMN IF NOT EXISTS product_scope TEXT
DEFAULT 'physical'
CHECK (product_scope IN ('digital', 'physical', 'service', 'restaurant', 'mixed'));
```

---

## 10. Fichiers à modifier lors de l'implémentation

| Fichier | Changement |
|---------|-----------|
| `supabase/migrations/` | Nouvelle migration `product_scope` sur `agents` |
| `src/app/api/agents/route.ts` | Accepter `product_scope` en POST/PATCH |
| `src/app/[locale]/dashboard/agents/new/page.tsx` | Sélecteur `product_scope` |
| `src/app/[locale]/dashboard/agents/[id]/page.tsx` | Sélecteur `product_scope` |
| `src/app/[locale]/dashboard/products/new/page.tsx` | Filtrer les types selon `product_scope` |
| `src/lib/whatsapp/ai/generator.js` | Passer `product_scope` au prompt builder |
| `src/lib/whatsapp/ai/prompt-builder.js` | Choisir workflow selon `product_scope` |
| `src/lib/whatsapp/services/checkout-state.service.js` | Adapter champs collectés selon scope |
| `src/lib/whatsapp/ai/tools/tool-orders.js` | Validation email/adresse selon scope |
| `src/app/[locale]/onboarding/` | Libellé numéro support clair |

---

## Hors scope V1

- Envoi email du produit numérique
- Vérification OTP numéro à l'inscription
- Scope `mixed` avec détection fine par item (simplifié : email requis si au moins un item digital)

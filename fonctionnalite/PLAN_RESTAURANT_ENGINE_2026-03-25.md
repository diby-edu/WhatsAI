# PLAN — Moteur Restaurant (RESTAURANT Engine)
**Date :** 2026-03-26
**Statut :** Validé après 6 rounds d'audit croisé — Prêt pour implémentation
**Exploitable en production :** NON sans corrections — `pending_pickup` absent API+UI, RLS bookings non appliqué en prod, version PG non confirmée
**Priorité :** Haute

---

## Décisions verrouillées

1. `restaurant` devient un moteur dédié `RESTAURANT` — séparé de `event` qui reste sur `TABLE`
2. Le panier restaurant ne passe ni par `cart-state.service.js` ni par `booking-state.service.js`
3. Le checkout restaurant passe par un **tool unique** `create_restaurant_checkout`
4. `category` = libellé marchand libre (affiché dans l'UI)
5. `menu_section_slug` = valeur canonique utilisée par le moteur (logique interne)
6. Les autres moteurs (STAY, TABLE, SLOT, RENTAL, INSCRIPTION) sont inchangés
7. **Toutes les opérations DB passent par des RPC atomiques** — jamais d'appels séquentiels
8. **Source de vérité unique pour l'acompte** : calcul serveur uniquement, bot dérive du retour tool

---

## Contraintes réelles du codebase

- `prompt-builder.js` mappe aujourd'hui `restaurant -> TABLE` → à changer
- `cart-state.service.js` exclut explicitement les produits `service` (ligne 751)
- `create_booking` ne sait créer qu'une réservation sur un seul `service_name`
- `create_order` ne couvre pas proprement `takeaway`
- Il n'existe pas de table `booking_items`
- `orders.payment_method` **existe déjà** en prod (`PRODUCTION_SCHEMA.sql:263`, `DEFAULT 'online'`) — migration IF NOT EXISTS safe
- `bookings.payment_method` ajouté via migration mais **sans CHECK DB** — à corriger
- RPC `create_order_with_items` ne prend pas `fulfillment_mode`, `pickup_at`, ni les champs `deposit_*` — réutilisation impossible telle quelle
- `pending_pickup` absent de l'API statut (`route.ts:21`) et de l'UI admin → doit être intégré complètement ou retiré du plan
- **`bookings.start_time`** écrit par la RPC — calculé depuis `preferred_date + preferred_time` avec timezone explicite (voir RPC ci-dessous)
- **Schema drift** : `PRODUCTION_SCHEMA.sql:313` dit `NOT NULL`, mais `20260325_inscription_booking.sql:13` l'a rendu nullable — ne pas utiliser `PRODUCTION_SCHEMA.sql` comme source de vérité sans reconciliation avec les migrations
- **RLS sur `bookings`** : aucune migration dans le repo n'active `ENABLE ROW LEVEL SECURITY` sur `bookings`, contrairement à `orders`/`order_items` (`003_products_orders.sql:142`) — risque sécurité actif, à corriger en Phase 1
- **`pending_pickup`** : absent de `validStatuses` dans `route.ts:21` et non géré dans l'UI `orders/page.tsx:166` — doit être ajouté dans API + UI avant de l'activer en DB

---

## Architecture produits

Tous les items restaurant sont `product_type = 'service'`, `service_subtype = 'restaurant'`.
**Pas de mélange avec product_type physique/digital.**

| Nom | product_type | service_subtype | category | menu_section_slug | Prix |
|---|---|---|---|---|---|
| Salade Niçoise | service | restaurant | Entrées | starters | 1 500 |
| Thiéboudiène | service | restaurant | Plats | mains | 3 500 |
| Extra viande | service | restaurant | Suppléments | extras | 500 |
| Fondant Chocolat | service | restaurant | Desserts | desserts | 1 800 |
| Jus Bissap | service | restaurant | Boissons | drinks | 800 |

**Slugs canoniques :** `starters | mains | extras | desserts | drinks | other`

---

## Parcours conversationnel validé

### Menu principal

```
Bot : Bienvenue chez [Nom] ! 👋

      1️⃣ Notre Carte
      2️⃣ Boissons (N)
      3️⃣ Réserver une table

      Tapez un numéro ou décrivez ce que vous souhaitez.
```

> "Notre Carte" = toutes les sections sauf drinks (starters → mains → extras → desserts)
> Sections vides → sautées automatiquement
> N = nb items actifs dans la catégorie

---

### Parcours guidé "Notre Carte" — course par course

**Règles d'affichage :**
- Première fois dans une section → afficher la liste complète + instruction complète
- Après un ajout → confirmation ✅ + section suivante affichée automatiquement
- Instruction : `Choisissez et précisez la quantité (ex : "...") ou tapez "suite" pour [suivant] · "modifier" pour [précédent].`
- Dernière section (desserts) → `ou tapez "suite" pour continuer · "modifier" pour [précédent].`
- Boissons → `ou tapez "valider" pour finaliser · "modifier" pour les desserts.`

```
Client : 1 (Notre Carte)
Bot    : 🥗 ENTRÉES
         · Salade Niçoise — 1 500 FCFA
         · Soupe de Poisson — 1 200 FCFA
         Choisissez et précisez la quantité (ex : "1 soupe")
         ou tapez "suite" pour les plats.

Client : 1 soupe
Bot    : ✅ 1× Soupe ajoutée
         🍽️ PLATS
         · Thiéboudiène — 3 500 FCFA
         · Yassa Poulet — 3 000 FCFA
         Choisissez et précisez la quantité (ex : "2 Thiéboudiène et 1 Yassa")
         ou tapez "suite" pour les suppléments · "modifier" pour les entrées.

Client : 2 thiéboudiène
Bot    : ✅ 2× Thiéboudiène ajoutés
         ➕ SUPPLÉMENTS
         · Extra viande — 500 FCFA
         · Sauce piquante — 200 FCFA
         Choisissez et précisez la quantité (ex : "2 extra viande")
         ou tapez "suite" pour les desserts · "modifier" pour les plats.

Client : suite
Bot    : 🍰 DESSERTS
         · Fondant Chocolat — 1 800 FCFA
         · Salade de Fruits — 1 000 FCFA
         Choisissez et précisez la quantité (ex : "1 fondant")
         ou tapez "suite" pour continuer · "modifier" pour les suppléments.

Client : 1 fondant
Bot    : ✅ 1× Fondant ajouté
         Votre commande :
         🥗 1× Soupe — 1 200 FCFA
         🍽️ 2× Thiéboudiène — 7 000 FCFA
         ➕ Aucun supplément
         🍰 1× Fondant — 1 800 FCFA
         💰 Sous-total : 10 000 FCFA

         🥤 BOISSONS
         · Jus Bissap — 800 FCFA
         · Eau Minérale — 500 FCFA
         Choisissez et précisez la quantité (ex : "2 bissap")
         ou tapez "valider" pour finaliser · "modifier" pour les desserts.

Client : 2 bissap
Bot    : ✅ 2× Jus Bissap ajoutés
         Récapitulatif final :
         🥗 1× Soupe — 1 200 FCFA
         🍽️ 2× Thiéboudiène — 7 000 FCFA
         🍰 1× Fondant — 1 800 FCFA
         🥤 2× Jus Bissap — 1 600 FCFA
         💰 Total : 11 600 FCFA

         ✏️ Tapez "modifier entrées/plats/suppléments/desserts/boissons" pour corriger
         ou choisissez le mode :
         1️⃣ Sur place
         2️⃣ À emporter
         3️⃣ Livraison
```

### Modification depuis le récap final

```
Client : modifier plats
Bot    : 🍽️ PLATS
         Sélection actuelle : 2× Thiéboudiène
         · Thiéboudiène — 3 500 FCFA
         · Yassa Poulet — 3 000 FCFA
         Retapez votre sélection complète pour remplacer
         ou tapez "retour" pour annuler.
```

La nouvelle saisie **remplace** l'ancienne intégralement.

---

### Flux par mode — collecte infos client (toujours en dernier)

#### Mode 1 — Sur place (`dine_in`)
```
→ Date et heure ? (une seule question 📅⏰)
→ Nombre de personnes ? 👥
→ Demandes particulières ?
→ Nom complet + téléphone (indicatif obligatoire) ? 👤📱
→ [Acompte si configuré]
→ Récap → Confirmation → create_restaurant_checkout(fulfillment_mode="dine_in")
```

#### Mode 2 — À emporter (`takeaway`)
```
→ Date et heure de récupération ? (une seule question 🕐)
→ Nom complet + téléphone (indicatif obligatoire) ? 👤📱
→ [Acompte si configuré]
→ Récap → Confirmation → create_restaurant_checkout(fulfillment_mode="takeaway")
```

#### Mode 3 — Livraison (`delivery`)
```
→ Adresse de livraison ? 📍
→ Nom complet + téléphone (indicatif obligatoire) ? 👤📱
→ [Acompte si configuré]
→ Récap → Confirmation → create_restaurant_checkout(fulfillment_mode="delivery")
```

#### Option directe — Réservation sans commande (`booking_only`)
```
Client : 3 (ou "réserver une table")
→ Date et heure ? 📅⏰
→ Nombre de personnes ? 👥
→ Demandes particulières ?
→ Nom complet + téléphone (indicatif obligatoire) ? 👤📱
→ [Acompte si configuré]
→ Récap → Confirmation → create_restaurant_checkout(fulfillment_mode="booking_only", items=[])
```

---

### Acompte configurable

Après confirmation du client, si `restaurant_deposit_enabled = true` :

**CinetPay :**
```
Bot : Pour confirmer, un acompte de 3 480 FCFA (30%) est requis.
      👉 [Lien de paiement CinetPay]
      Votre réservation sera confirmée dès réception du paiement.
```

**Manuel (Mobile Money) :**
```
Bot : Pour confirmer, versez 3 480 FCFA (30%) via :
      📱 Orange Money : +225 07 00 00 00
      Envoyez votre reçu pour valider.
```

**Sans acompte :**
```
Bot : ✅ Réservation confirmée !
```

---

## Récapitulatifs types

### Sur place avec commande
```
Récapitulatif de votre réservation :
🥗 1× Soupe | 🍽️ 2× Thiéboudiène | 🍰 1× Fondant | 🥤 2× Bissap
💰 Total : 11 600 FCFA
📅 Samedi 29 mars à 20h00 — 4 personnes
👤 Koné Seydou | 📱 +225 07 00 00 00
📝 Notes : Table en terrasse
Confirmez-vous ?
```

### À emporter
```
💰 Total : 9 400 FCFA
🕐 Récupération : Samedi 29 mars à 19h30
👤 Koné Seydou | 📱 +225 07 00 00 00
Confirmez-vous ?
```

### Livraison
```
💰 Total : 9 400 FCFA
🚚 Livraison : Cocody Angré, rue des jardins
👤 Koné Seydou | 📱 +225 07 00 00 00
Confirmez-vous ?
```

### Réservation sans commande
```
📅 Samedi 29 mars à 20h00 — 4 personnes
👤 Koné Seydou | 📱 +225 07 00 00 00
📝 Notes : Aucune
Confirmez-vous ?
```

---

## Schéma de données cible

### 1. Products

```sql
ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS menu_section_slug TEXT;

ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS menu_sort_order INTEGER DEFAULT 100;

ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS products_menu_section_slug_check;

ALTER TABLE public.products
    ADD CONSTRAINT products_menu_section_slug_check
    CHECK (
        menu_section_slug IS NULL OR
        menu_section_slug IN ('starters', 'mains', 'extras', 'desserts', 'drinks', 'other')
    );

CREATE INDEX IF NOT EXISTS idx_products_restaurant_menu
    ON public.products(agent_id, service_subtype, menu_section_slug, menu_sort_order);
```

### 2. Agents

```sql
ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.agents
    DROP CONSTRAINT IF EXISTS agents_restaurant_deposit_percentage_check;

ALTER TABLE public.agents
    ADD CONSTRAINT agents_restaurant_deposit_percentage_check
    CHECK (restaurant_deposit_percentage >= 0 AND restaurant_deposit_percentage <= 100);
```

### 3. Orders

```sql
-- fulfillment_mode avec CHECK enum
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_fulfillment_mode_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_fulfillment_mode_check
    CHECK (fulfillment_mode IS NULL OR
           fulfillment_mode IN ('takeaway', 'delivery'));

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ;

-- payment_method existe déjà en prod (DEFAULT 'online') — IF NOT EXISTS safe
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

-- deposit_status avec CHECK enum et transitions définies
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_deposit_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_deposit_status_check
    CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'expired', 'waived'));

-- pending_pickup ajouté avec support complet API + UI (voir Phase 5)
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (status IN (
        'pending','paid','confirmed','pending_pickup','pending_delivery',
        'processing','shipped','delivered','cancelled','refunded'
    ));
```

### 4. Bookings

```sql
-- fulfillment_mode avec CHECK enum
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_fulfillment_mode_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_fulfillment_mode_check
    CHECK (fulfillment_mode IS NULL OR
           fulfillment_mode IN ('dine_in', 'booking_only'));

-- payment_method : existe déjà via migration mais sans CHECK — à contraindre
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_payment_method_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_payment_method_check
    CHECK (payment_method IS NULL OR
           payment_method IN ('online', 'onsite'));

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_deposit_status_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_deposit_status_check
    CHECK (deposit_status IN ('not_required', 'pending', 'paid', 'expired', 'waived'));
```

### 5. Nouvelle table booking_items (avec RLS)

```sql
CREATE TABLE IF NOT EXISTS public.booking_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    product_category TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_fcfa INTEGER NOT NULL DEFAULT 0,
    line_total_fcfa INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_booking_items_booking_id
    ON public.booking_items(booking_id);

-- RLS sur bookings : aucune migration existante ne l'active (gap confirmé)
-- À exécuter ET vérifier : SELECT relrowsecurity FROM pg_class WHERE relname='bookings';
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "bookings_agent_access"
    ON public.bookings
    USING (
        agent_id IN (
            SELECT id FROM public.agents WHERE user_id = auth.uid()
        )
    );

-- RLS obligatoire — même niveau que orders/order_items
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "booking_items_agent_access"
    ON public.booking_items
    USING (
        booking_id IN (
            SELECT id FROM public.bookings WHERE agent_id IN (
                SELECT id FROM public.agents WHERE user_id = auth.uid()
            )
        )
    );
```

### 6. RPC atomique pour bookings restaurant

Deux RPC dédiées — ne jamais faire d'appels séquentiels depuis `tool-restaurant.js` :

```sql
-- RPC 1 : dine_in avec ou sans précommande
CREATE OR REPLACE FUNCTION create_restaurant_booking(
    p_agent_id UUID,
    p_user_id UUID,
    p_conversation_id UUID,
    p_fulfillment_mode TEXT,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_preferred_date DATE,
    p_preferred_time TIME,
    p_party_size INTEGER,
    p_payment_method TEXT,
    p_notes TEXT,
    p_deposit_required BOOLEAN,
    p_deposit_percentage INTEGER,
    p_deposit_amount_fcfa INTEGER,
    p_items JSONB,  -- [] pour booking_only
    p_timezone TEXT DEFAULT 'Africa/Abidjan'  -- timezone du marchand (profiles.timezone)
) RETURNS JSONB
LANGUAGE plpgsql AS $$
DECLARE
    v_booking_id UUID;
    v_total_fcfa INTEGER := 0;
    v_item JSONB;
BEGIN
    -- Calcul total depuis items
    SELECT COALESCE(SUM((i->>'line_total_fcfa')::INTEGER), 0)
    INTO v_total_fcfa FROM jsonb_array_elements(p_items) i;

    -- Insert booking
    -- start_time OBLIGATOIRE : admin trie/affiche sur start_time (route.ts:50, page.tsx:286)
    -- Calculé depuis preferred_date + preferred_time pour éviter NULL silencieux
    INSERT INTO public.bookings (
        agent_id, user_id, conversation_id,
        booking_type, fulfillment_mode,
        customer_name, customer_phone,
        preferred_date, preferred_time,
        start_time,
        party_size, payment_method, notes,
        price_fcfa,
        deposit_required, deposit_percentage,
        deposit_amount_fcfa,
        deposit_status
    ) VALUES (
        p_agent_id, p_user_id, p_conversation_id,
        'table', p_fulfillment_mode,
        p_customer_name, p_customer_phone,
        p_preferred_date, p_preferred_time,
        -- Timezone du marchand : p_timezone DEFAULT 'Africa/Abidjan'
        -- Le produit supporte des marchands hors UTC+0 (Cameroun, Nigeria, France, etc.)
        -- Défaut Africa/Abidjan pour V1 — sans changement pour marché cible initial
        (p_preferred_date::TEXT || ' ' || p_preferred_time::TEXT)::TIMESTAMP AT TIME ZONE p_timezone,
        p_party_size, p_payment_method, p_notes,
        v_total_fcfa,
        p_deposit_required, p_deposit_percentage,
        p_deposit_amount_fcfa,
        CASE WHEN p_deposit_required THEN 'pending' ELSE 'not_required' END
    ) RETURNING id INTO v_booking_id;

    -- Insert booking_items si présents
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        INSERT INTO public.booking_items (
            booking_id, product_id, product_name,
            product_category, quantity,
            unit_price_fcfa, line_total_fcfa
        ) VALUES (
            v_booking_id,
            (v_item->>'product_id')::UUID,
            v_item->>'product_name',
            v_item->>'product_category',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price_fcfa')::INTEGER,
            (v_item->>'line_total_fcfa')::INTEGER
        );
    END LOOP;

    RETURN jsonb_build_object(
        'booking_id', v_booking_id,
        'total_fcfa', v_total_fcfa,
        'deposit_status', CASE WHEN p_deposit_required THEN 'pending' ELSE 'not_required' END
    );
END;
$$;

-- RPC 2 : takeaway / delivery — étend create_order_with_items
-- Ajouter fulfillment_mode, pickup_at, deposit_* à la RPC existante
-- via une nouvelle migration (ne pas modifier create_order_with_items directement)
```

---

## Tool : `create_restaurant_checkout`

Unique point de sortie outillé du moteur RESTAURANT. Ne jamais appeler `create_order` ou `create_booking` directement depuis ce moteur.

### Input
```json
{
  "fulfillment_mode": "dine_in",
  "items": [
    { "product_name": "Thieboudienne", "quantity": 2 },
    { "product_name": "Jus Bissap", "quantity": 2 }
  ],
  "customer_name": "Kone Seydou",
  "customer_phone": "+2250700000000",
  "scheduled_date": "2026-03-29",
  "scheduled_time": "20:00",
  "party_size": 4,
  "delivery_address": null,
  "payment_method": "onsite",
  "notes": "Table en terrasse"
}
```

### Routing interne

| fulfillment_mode | Table créée | Items |
|---|---|---|
| `dine_in` | `bookings` + `booking_items` | si items > 0 |
| `booking_only` | `bookings` | aucun |
| `takeaway` | `orders` + `order_items` | obligatoire |
| `delivery` | `orders` + `order_items` | obligatoire + adresse |

### Mapping payment_method

- `bookings` : `online | onsite`
- `orders` : `online → online`, `onsite → cod`

### Output
```json
{
  "success": true,
  "record_type": "booking",
  "record_id": "uuid",
  "fulfillment_mode": "dine_in",
  "total_fcfa": 11600,
  "deposit_required": true,
  "deposit_amount_fcfa": 3480,
  "payment_method": "onsite",
  "message": "Réservation enregistrée..."
}
```

---

## State machine — `restaurant-state.service.js`

### Stages
```js
RESTAURANT_MENU_HOME    // menu principal
RESTAURANT_SECTION      // navigation course par course
RESTAURANT_DRINKS       // boissons + récap intermédiaire
RESTAURANT_MODE         // choix dine_in / takeaway / delivery / booking_only
RESTAURANT_CUSTOMER_FLOW // collecte date, adresse, nom, téléphone
RESTAURANT_RECAP        // récap final + modification
RESTAURANT_DEPOSIT      // acompte si activé
```

### État minimal
```js
{
  stage: 'RESTAURANT_SECTION',
  section_slug: 'mains',
  section_order: ['starters', 'mains', 'extras', 'desserts'],
  drinks_enabled: true,
  cart_items: [
    {
      product_id: 'uuid',
      product_name: 'Thiéboudiène',
      menu_section_slug: 'mains',
      quantity: 2,
      unit_price_fcfa: 3500,
      line_total_fcfa: 7000
    }
  ],
  fulfillment_mode: null,
  customer_flow: {
    scheduled_date: null,
    scheduled_time: null,
    party_size: null,
    delivery_address: null,
    customer_name: null,
    customer_phone: null,
    notes: null,
    payment_method: null
  }
}
```

### Règles d'intégration
- State restaurant vit dans `conversation.metadata.restaurant`
- Prioritaire sur `cart`, `checkout`, `booking` quand un flow restaurant est actif
- Mergé dans `generator.js` comme les autres state services

---

## Fichiers à créer ou modifier

### Phase 1 — Schéma (SQL à exécuter dans Supabase)
Les 5 migrations SQL ci-dessus dans l'ordre :
1. `products` (menu_section_slug, menu_sort_order)
2. `agents` (restaurant_deposit_enabled, restaurant_deposit_percentage)
3. `orders` (fulfillment_mode, pickup_at, deposit…)
4. `bookings` (fulfillment_mode, deposit…)
5. Création `booking_items`

### Phase 2 — Tooling
6. `src/lib/whatsapp/ai/tools/definitions.js` → ajouter `create_restaurant_checkout`
7. Nouveau `src/lib/whatsapp/ai/tools/tool-restaurant.js` → résolution catalogue, calcul total, création records, acompte
8. `src/lib/whatsapp/ai/tools.js` → dispatch `create_restaurant_checkout`

### Phase 3 — Routing moteur
9. `src/lib/whatsapp/ai/prompt-builder.js` → `restaurant → RESTAURANT`, `event → TABLE`
10. Nouveau `src/lib/whatsapp/ai/prompts/workflow-service-restaurant.js`
11. `src/lib/whatsapp/ai/prompts/sections.js` → `buildRestaurantMenuSection(products)` groupé par `menu_section_slug`

### Phase 4 — State machine
12. Nouveau `src/lib/whatsapp/services/restaurant-state.service.js`
13. `src/lib/whatsapp/handlers/message.js` → détecter `restaurantProducts`, exécuter state restaurant en priorité
14. `src/lib/whatsapp/ai/generator.js` → merge state restaurant dans les args tool

### Phase 5 — UI produits & agents
15. `src/app/[locale]/dashboard/products/new/page.tsx` + `[id]/page.tsx`
    - Select `menu_section_slug` si `service_subtype === 'restaurant'`
    - Champ `category` (libellé visible)
    - Champ `menu_sort_order`
16. `src/app/[locale]/dashboard/agents/new/page.tsx` + `[id]/page.tsx`
    - Toggle `restaurant_deposit_enabled`
    - Champ `restaurant_deposit_percentage`

### Phase 6 — Admin / lecture
17. `src/app/[locale]/admin/bookings/page.tsx` → afficher `fulfillment_mode`, acompte, `booking_items`
18. `src/app/[locale]/admin/orders/page.tsx` → afficher `fulfillment_mode`, `pickup_at`, acompte

### Phase 7 — Tests
19. Tests unitaires `tool-restaurant.js`
20. Tests unitaires `restaurant-state.service.js`
21. Tests prompts (ne pas appeler `create_order`/`create_booking` directement)
22. Tests intégration mode par mode

---

## Matrice de tests minimale

### Tool
- `dine_in + items` → crée `booking + booking_items`
- `booking_only` → crée `booking` sans items
- `takeaway` → crée `order + order_items + pickup_at`
- `delivery` → refuse sans adresse
- acompte activé → calcule `deposit_amount_fcfa`
- `payment_method=onsite` → mappe vers `cod` pour `orders`

### State machine
- Entrée par "Notre Carte"
- Entrée directe par "Boissons"
- Entrée directe par "Réserver une table"
- `modifier plats` depuis récap
- Section vide → sautée automatiquement
- Récap intermédiaire avant boissons affiché

### Prompt
- N'appelle jamais `create_order` ou `create_booking` directement
- Appelle uniquement `create_restaurant_checkout`
- Ne demande pas d'adresse hors mode `delivery`

---

## Cycle de vie de l'acompte

### Transitions deposit_status

```
not_required  →  (aucune transition — pas d'acompte)
pending       →  paid      (webhook CinetPay ou confirmation manuelle admin)
pending       →  expired   (24h sans paiement — tâche cron ou check à la lecture)
pending       →  waived    (annulation manuelle par marchand)
paid          →  (état final)
expired       →  (état final — commande peut être annulée)
waived        →  (état final)
```

### Source de vérité unique

- **Calcul** : côté serveur dans `tool-restaurant.js` uniquement
  - `deposit_amount_fcfa = Math.round(total_fcfa * deposit_percentage / 100)`
- **Message bot** : toujours dérivé du retour tool — jamais calculé côté prompt
- **Jamais de double calcul** entre le récap intermédiaire et la confirmation

### Nettoyage conversation.metadata.restaurant

| Déclencheur | Action |
|---|---|
| Confirmation client + tool appelé | `delete conversation.metadata.restaurant` |
| Client dit "annuler" ou abandonne | `delete conversation.metadata.restaurant` |
| Timeout 24h sans activité | reset au prochain message entrant |
| Nouvelle conversation (reset) | state inexistant → RESTAURANT_MENU_HOME |

---

## Support complet de pending_pickup

`pending_pickup` est ajouté au CHECK SQL mais doit être supporté partout :

### API (`src/app/api/orders/[id]/status/route.ts`)
Ajouter `'pending_pickup'` dans `validStatuses` (actuellement absent).

### UI admin (`src/app/[locale]/admin/orders/page.tsx`)
- Ajouter filtre `pending_pickup` dans les stats
- Ajouter label et badge couleur (ex : orange — "En attente retrait")
- Ajouter transition possible : `pending_pickup → confirmed → delivered`

### Logique
- `takeaway` → statut initial `pending_pickup` (commande prête, client vient chercher)
- `delivery` → statut initial `pending_delivery` (existant)

---

## Points validés — consensus 5 rounds d'audit

| Point | Statut | Preuve |
|---|---|---|
| start_time écrit dans RPC (ligne 493, calculé ligne 506) | ✅ Corrigé | Lu dans le plan courant |
| Atomicité booking + booking_items via RPC dédiée | ✅ Verrouillé | RPC `create_restaurant_booking` complète |
| deposit_status : transitions définies (not_required → pending → paid/expired/waived) | ✅ Verrouillé | Section "Cycle de vie de l'acompte" |
| conversation.metadata.restaurant : nettoyage documenté | ✅ Verrouillé | Tableau des déclencheurs |
| CHECK sur fulfillment_mode et deposit_status (orders + bookings) | ✅ Corrigé | SQL ajouté dans schéma Phase 1 |
| bookings.payment_method : CHECK online\|onsite ajouté | ✅ Corrigé | Migration Phase 1 |
| RLS sur bookings : gap confirmé, corrigé dans le plan | ✅ Corrigé plan / À appliquer en prod | `003_products_orders.sql:142` = référence |
| RLS sur booking_items : ajouté dans le plan | ✅ Corrigé plan | Section schéma |
| order_number : généré par trigger, pas à répliquer | ✅ Confirmé | `003_products_orders.sql:133` |
| orders.payment_method existe déjà en prod | ✅ Confirmé | `PRODUCTION_SCHEMA.sql:263` |
| Schema drift PRODUCTION_SCHEMA vs migrations | ✅ Documenté | start_time NOT NULL → nullable |
| pending_pickup absent API + UI | ✅ Documenté, à implémenter | `route.ts:21`, `page.tsx:166` |
| p_timezone paramétrable, DEFAULT 'Africa/Abidjan' | ✅ Verrouillé | Produit supporte Cameroun/Nigeria/France (`profile-phone.ts:16,26,28`) — timezone configurable via API (`profile/route.ts:40`) |
| Source de vérité acompte : serveur uniquement | ✅ Verrouillé | Décision 8 |

## Points en cours d'analyse — discorde non résolue

| Point | Position actuelle | Raison du désaccord |
|---|---|---|
| `CREATE POLICY IF NOT EXISTS` — version PG serveur | ⚠️ Syntaxe déjà utilisée dans le repo (`006_extend_subscription_plans.sql:42`) — objection portabilité affaiblie mais version serveur non prouvée sans `SHOW server_version;` | Alternative sûre disponible : pattern `DO $$ IF NOT EXISTS ... $$` compatible PG 9.5+ |

---

## Hors scope V1
- Frais de livraison dynamiques / zones de livraison
- Stock temps réel par tranche horaire
- Split payment
- Acompte différent selon le mode
- Recommandations upsell automatiques
- Paramétrage timezone par agent (si déploiement multi-timezone futur)

---

## Couverture des 6 cas

| Cas | Chemin | fulfillment_mode |
|---|---|---|
| Commande + livraison | Notre Carte → Boissons → Valider → Livraison | `delivery` |
| Commande + sur place | Notre Carte → Boissons → Valider → Sur place | `dine_in` |
| Commande + à emporter | Notre Carte → Boissons → Valider → À emporter | `takeaway` |
| Boissons uniquement | Option 2 → Valider → mode | idem |
| Réservation sans commande | Option 3 directe | `booking_only` |
| Mix toutes catégories | Navigation complète → Valider → mode | idem |

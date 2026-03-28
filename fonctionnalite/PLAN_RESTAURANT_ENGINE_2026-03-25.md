# PLAN — Moteur Restaurant (RESTAURANT Engine)
**Date :** 2026-03-26
**Statut :** Validé après audit croisé multi-rounds — Prêt pour implémentation (checklist clôture intégrée)
**Exploitable en production :** NON sans exécution des migrations SQL et déploiement ordonné (voir Runbook de déploiement)
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

-- payment_method : ajouté ici pour rendre le bloc autonome
-- (colonne créée par migration séparée 20260325_booking_payment_method.sql — IF NOT EXISTS safe)
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

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

-- booking_source : marqueur SQL pour retrouver les réservations restaurant sans JOIN products
-- Nécessaire car service_subtype vit dans products, pas dans bookings
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS booking_source TEXT DEFAULT 'general';

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_booking_source_check;

ALTER TABLE public.bookings
    ADD CONSTRAINT bookings_booking_source_check
    CHECK (booking_source IS NULL OR booking_source IN ('restaurant', 'general'));

-- transaction_id : requis pour la route booking-initiate (Phase 6b) et le lookup webhook BKG_*
-- Sans cette colonne, la migration Phase 4 Bookings est incohérente avec la Phase 6b
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS transaction_id TEXT;

-- provider_payment_url : requis pour l'idempotence de booking-initiate
-- Permet de retourner le même lien CinetPay si transaction_id existe déjà
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS provider_payment_url TEXT;

-- Index pour le lookup webhook BKG_* (évite un full scan sur bookings)
CREATE INDEX IF NOT EXISTS idx_bookings_transaction_id
    ON public.bookings(transaction_id);

-- Note V1 : transaction_id est simplement indexé.
-- Décision UNIQUE : à appliquer en V2 si on garantit qu'une réservation n'a qu'une transaction active
-- (UNIQUE WHERE transaction_id IS NOT NULL serait la forme correcte)
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

-- CREATE POLICY IF NOT EXISTS n'existe PAS en PostgreSQL standard (absent de PG 9.5 à PG 18)
-- Pattern safe : DO $$ avec vérification pg_policies
-- Pattern granulaire : SELECT/INSERT/UPDATE séparés — même niveau que orders/order_items
-- (003_products_orders.sql:159-178). Pas de DELETE policy — même choix intentionnel que orders.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_select_agent') THEN
        CREATE POLICY "bookings_select_agent" ON public.bookings
            FOR SELECT USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_insert_agent') THEN
        CREATE POLICY "bookings_insert_agent" ON public.bookings
            FOR INSERT WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bookings' AND policyname='bookings_update_agent') THEN
        CREATE POLICY "bookings_update_agent" ON public.bookings
            FOR UPDATE USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
    END IF;
END $$;

-- RLS obligatoire — même niveau que orders/order_items
ALTER TABLE public.booking_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='booking_items' AND policyname='booking_items_select_agent') THEN
        CREATE POLICY "booking_items_select_agent" ON public.booking_items
            FOR SELECT USING (booking_id IN (SELECT id FROM public.bookings WHERE agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='booking_items' AND policyname='booking_items_insert_agent') THEN
        CREATE POLICY "booking_items_insert_agent" ON public.booking_items
            FOR INSERT WITH CHECK (booking_id IN (SELECT id FROM public.bookings WHERE agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())));
    END IF;
END $$;
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
    p_service_name TEXT,  -- nom du restaurant / libellé affiché dans admin + message confirmation WhatsApp (bookings/[id]/status/route.ts:66, page.tsx:857)
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
    -- COALESCE obligatoire : jsonb_array_elements(NULL) lève une erreur PostgreSQL
    SELECT COALESCE(SUM((i->>'line_total_fcfa')::INTEGER), 0)
    INTO v_total_fcfa FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) i;

    -- Insert booking
    -- start_time OBLIGATOIRE : admin trie/affiche sur start_time (route.ts:50, page.tsx:286)
    -- Calculé depuis preferred_date + preferred_time pour éviter NULL silencieux
    INSERT INTO public.bookings (
        agent_id, user_id, conversation_id,
        booking_type, fulfillment_mode,
        service_name,
        customer_name, customer_phone,
        preferred_date, preferred_time,
        start_time,
        party_size, payment_method, notes,
        price_fcfa,
        status,
        deposit_required, deposit_percentage,
        deposit_amount_fcfa,
        deposit_status,
        booking_source
    ) VALUES (
        p_agent_id, p_user_id, p_conversation_id,
        'table', p_fulfillment_mode,
        p_service_name,
        p_customer_name, p_customer_phone,
        p_preferred_date, p_preferred_time,
        -- Timezone du marchand : p_timezone DEFAULT 'Africa/Abidjan'
        -- Le produit supporte des marchands hors UTC+0 (Cameroun, Nigeria, France, etc.)
        -- Défaut Africa/Abidjan pour V1 — sans changement pour marché cible initial
        (p_preferred_date::TEXT || ' ' || p_preferred_time::TEXT)::TIMESTAMP AT TIME ZONE p_timezone,
        p_party_size, p_payment_method, p_notes,
        v_total_fcfa,
        -- status explicite : évite DEFAULT 'confirmed' sur une réservation avec acompte impayé
        -- Valeurs valides vérifiées en prod : pending|confirmed|completed|cancelled|inscription_pending
        CASE WHEN p_deposit_required THEN 'pending' ELSE 'confirmed' END,
        p_deposit_required, p_deposit_percentage,
        p_deposit_amount_fcfa,
        CASE WHEN p_deposit_required THEN 'pending' ELSE 'not_required' END,
        'restaurant'  -- marqueur SQL fixe : toute booking créée par cette RPC est un restaurant
    ) RETURNING id INTO v_booking_id;

    -- Insert booking_items si présents
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
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

-- ════════════════════════════════════════════════════════════
-- RPC 2 : takeaway / delivery
-- NOUVELLE RPC create_restaurant_order_with_items
-- ⛔ NE JAMAIS DROP ni modifier la signature de create_order_with_items
-- Raison : signature actuelle (11 paramètres positionnels) encore appelée par tool-orders.js:192
-- Signature figée dans 20260319_fix_order_number_ambiguity.sql:17
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION create_restaurant_order_with_items(
    p_user_id          UUID,
    p_agent_id         UUID,
    p_conversation_id  UUID,
    p_customer_name    TEXT,
    p_customer_phone   TEXT,
    p_delivery_address TEXT,
    p_payment_method   TEXT,
    p_notes            TEXT,
    p_total_fcfa       INTEGER,
    p_status           TEXT,
    p_items            JSONB,
    -- Paramètres restaurant additionnels (absents de create_order_with_items)
    p_fulfillment_mode TEXT,       -- 'takeaway' | 'delivery'
    p_pickup_at        TIMESTAMPTZ,
    p_deposit_required BOOLEAN     DEFAULT FALSE,
    p_deposit_percentage INTEGER   DEFAULT 0,
    p_deposit_amount_fcfa INTEGER  DEFAULT 0,
    p_deposit_status   TEXT        DEFAULT 'not_required'
)
RETURNS TABLE(order_id UUID, order_number TEXT)
LANGUAGE plpgsql
AS $$
DECLARE
    v_order_id     UUID;
    v_order_number TEXT;
    v_item         JSONB;
BEGIN
    -- Validations minimales (même niveau que create_order_with_items existante)
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required' USING ERRCODE = 'P0003';
    END IF;
    IF p_customer_phone IS NULL OR p_customer_phone = '' THEN
        RAISE EXCEPTION 'customer_phone is required' USING ERRCODE = 'P0004';
    END IF;
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'items array is required' USING ERRCODE = 'P0005';
    END IF;
    IF p_fulfillment_mode NOT IN ('takeaway', 'delivery') THEN
        RAISE EXCEPTION 'fulfillment_mode must be takeaway or delivery' USING ERRCODE = 'P0006';
    END IF;

    INSERT INTO public.orders (
        user_id, agent_id, conversation_id,
        customer_name, customer_phone,
        delivery_address, payment_method, notes,
        total_fcfa, status,
        fulfillment_mode, pickup_at,
        deposit_required, deposit_percentage,
        deposit_amount_fcfa, deposit_status
    ) VALUES (
        p_user_id, p_agent_id, p_conversation_id,
        p_customer_name, p_customer_phone,
        p_delivery_address, p_payment_method, p_notes,
        p_total_fcfa, p_status,
        p_fulfillment_mode, p_pickup_at,
        p_deposit_required, p_deposit_percentage,
        p_deposit_amount_fcfa, p_deposit_status
    ) RETURNING id, order_number INTO v_order_id, v_order_number;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb)) LOOP
        INSERT INTO public.order_items (
            order_id, product_id, product_name,
            quantity, unit_price_fcfa
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            v_item->>'product_name',
            (v_item->>'quantity')::INTEGER,
            (v_item->>'unit_price_fcfa')::INTEGER
        );
    END LOOP;

    RETURN QUERY SELECT v_order_id, v_order_number;
END;
$$;

GRANT EXECUTE ON FUNCTION create_restaurant_order_with_items TO authenticated;
GRANT EXECUTE ON FUNCTION create_restaurant_order_with_items TO service_role;
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
  "deposit_status": "pending",
  "payment_method": "onsite",
  "payment_link": "https://...",
  "message": "Réservation enregistrée..."
}
```

> `payment_link` : présent si `deposit_required=true` ET `payment_method='online'` (CinetPay).
> `null` si paiement sur place ou sans acompte.
> Le bot dérive systématiquement son message depuis ce retour — jamais de calcul côté prompt.

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
- **Détection mode restaurant** dans `message.js` : `const restaurantProducts = serviceProducts.filter(p => p.service_subtype === 'restaurant')` — si `restaurantProducts.length > 0`, le flow restaurant est éligible
- **Détection mode restaurant** dans `prompt-builder.js` : déjà opérationnel via `SERVICE_ENGINE_MAP['restaurant']` — changer la valeur de `'TABLE'` vers `'RESTAURANT'` (Phase 3)
- `create_order` et `create_booking` sont masqués **côté code** dans `generator.js` via un tableau `RESTAURANT_DISABLED_TOOLS = ['create_order', 'create_booking']` filtré quand le moteur RESTAURANT est actif — même pattern que `SUPPORT_CLIENT_DISABLED_TOOLS` (ligne 318 de `generator.js`). Le prompt RESTAURANT renforce cette exclusivité mais n'est pas la seule barrière.

---

## Fichiers à créer ou modifier

### Phase 1 — Schéma (SQL à exécuter dans Supabase)
Les migrations dans l'ordre — toutes requises avant Phase 2 :
1. `products` (menu_section_slug, menu_sort_order)
2. `agents` (restaurant_deposit_enabled, restaurant_deposit_percentage)
3. `orders` (fulfillment_mode, pickup_at, deposit…)
4. `bookings` (payment_method, fulfillment_mode, deposit…)
5. Création `booking_items` + activation RLS
6. RPC `create_restaurant_booking` (dine_in + booking_only)
7. **Nouvelle** RPC `create_restaurant_order_with_items` (fulfillment_mode, pickup_at, deposit_*) — **NE PAS DROP ni modifier la signature de `create_order_with_items` existante** : signature actuelle (11 paramètres positionnels) appelée par `tool-orders.js:192` en prod — tout DROP casserait l'existant avec `42883 function does not exist`

### Phase 2 — Tooling
6. `src/lib/whatsapp/ai/tools/definitions.js` → ajouter `create_restaurant_checkout`
7. Nouveau `src/lib/whatsapp/ai/tools/tool-restaurant.js` → résolution catalogue, calcul total, création records, acompte
8. `src/lib/whatsapp/ai/tools.js` → dispatch `create_restaurant_checkout`

### Phase 3 — Routing moteur
9. `src/lib/whatsapp/ai/prompt-builder.js` :
   - Changer `SERVICE_ENGINE_MAP['restaurant']` de `'TABLE'` vers `'RESTAURANT'` (ligne 23)
   - `event` reste sur `'TABLE'` — inchangé
   - **Guard `prompt-builder.js:231`** : le bloc `if (isServiceFlow && false)` qui pousse `create_booking` pour les services génériques est déjà neutralisé par le `&& false`. Ce guard doit rester désactivé quand RESTAURANT est actif. Lors de l'implémentation, remplacer la condition par `if (isServiceFlow && activeEngine !== 'RESTAURANT')` pour le rendre explicite et éviter une régression si le `&& false` est retiré.
10. Nouveau `src/lib/whatsapp/ai/prompts/workflow-service-restaurant.js`
11. `src/lib/whatsapp/ai/prompts/sections.js` → `buildRestaurantMenuSection(products)` groupé par `menu_section_slug`

### Phase 4 — State machine
12. Nouveau `src/lib/whatsapp/services/restaurant-state.service.js`
13. `src/lib/whatsapp/handlers/message.js` → détecter les produits restaurant via `serviceProducts.filter(p => p.service_subtype === 'restaurant')` (variable `restaurantProducts` n'existe pas — utiliser ce filtre), exécuter state restaurant en priorité
14. `src/lib/whatsapp/ai/generator.js` :
    - Merge state restaurant dans les args tool
    - Ajouter `RESTAURANT_DISABLED_TOOLS = ['create_order', 'create_booking']` filtré quand moteur RESTAURANT actif (même pattern que `SUPPORT_CLIENT_DISABLED_TOOLS` ligne 318)
    - **Mettre à jour la liste `directToolResponse` (ligne 394)** : ajouter `'create_restaurant_checkout'` dans le tableau `['create_order', 'create_booking', 'check_payment_status', 'find_order']` — sans ça, le tool s'exécute mais la réponse structurée (payment_link, récap, message final) n'est pas remontée comme `directToolResponse` et déclenche un second appel modèle non contrôlé

### Phase 5 — UI produits & agents
15. `src/app/[locale]/dashboard/products/new/page.tsx` + `[id]/page.tsx`
    - Select `menu_section_slug` si `service_subtype === 'restaurant'`
    - Champ `category` (libellé visible)
    - Champ `menu_sort_order`
16. `src/app/[locale]/dashboard/agents/new/page.tsx` + `[id]/page.tsx`
    - Toggle `restaurant_deposit_enabled`
    - Champ `restaurant_deposit_percentage`

### Phase 6 — Admin + Dashboard marchand / lecture
17. `src/app/[locale]/admin/bookings/page.tsx` → afficher `fulfillment_mode`, acompte, `booking_items`
18. `src/app/[locale]/admin/orders/page.tsx` → afficher `fulfillment_mode`, `pickup_at`, acompte
19. Routes API admin bookings :
    - `src/app/api/admin/bookings/route.ts` GET : sélectionner les nouveaux champs (`fulfillment_mode`, `deposit_required`, `deposit_amount_fcfa`, `deposit_status`, `payment_method`, `booking_source`, `transaction_id`, `booking_items`)
    - **Filtrer par `booking_source='restaurant'` pour les vues restaurant** — sans ce filtre, l'admin voit toutes les bookings `booking_type='table'` y compris les events, qui partagent le même type
    - `src/app/[locale]/admin/bookings/page.tsx` : exploiter `booking_source` pour l'étiquetage et le filtrage UI
20. `src/app/[locale]/dashboard/orders/page.tsx` → support complet `pending_pickup` :
    - Filtre et badge "En attente retrait" (orange)
    - Transitions : `pending_pickup → confirmed → delivered`
    - Stats dashboard incluant `pending_pickup`
21. `src/app/api/admin/bookings/[id]/route.ts` → étendre le PATCH :
    - Accepter `status?` ET `deposit_status?` — rejeter les payloads vides (ni l'un ni l'autre)
    - Rejeter les transitions invalides (ex: `deposit_status: 'paid' → 'pending'` interdit)
    - Transitions `deposit_status` valides : `pending → paid | waived | expired` uniquement
    - Si `deposit_status → 'paid'` ET `bookings.status = 'pending'` → `status = 'confirmed'` dans le même update
    - Si `deposit_status → 'waived'` → `status = 'confirmed'` également (le marchand lève l'obligation d'acompte)
    - Mettre à jour `updated_at` dans tous les cas

### Phase 6b — Paiement acompte booking (online uniquement)
> Requis pour que `payment_link` soit réellement fonctionnel dans le retour tool

22. Nouvelle route `src/app/api/payments/cinetpay/booking-initiate/route.ts` :
    - **Entrée : `{ booking_id }` uniquement** — ne jamais accepter `amount` du body client ou de l'IA
    - La route relit `bookings.deposit_amount_fcfa` depuis la DB, vérifie `deposit_required=true`, `payment_method='online'`, `deposit_status='pending'`
    - `transaction_id = 'BKG_' + timestamp + random` (préfixe distinct pour le webhook)
    - Écrit `bookings.transaction_id` **et** `bookings.provider_payment_url` en DB, **ne crée rien dans la table `payments`**
    - **Idempotence** : si `bookings.transaction_id` est déjà renseigné, retourner `{ success: true, payment_url: bookings.provider_payment_url, transaction_id: bookings.transaction_id }` sans ré-initier
    - **Sortie** : `{ success: boolean, payment_url: string, transaction_id: string }`
    - Route protégée par auth — **jamais exposée en endpoint public anonyme**
    - Ne modifie pas la logique existante `ORD_*` — extension pure, pas refonte
23. `src/app/api/payments/cinetpay/webhook/route.ts` → ajouter branche `BKG_*` **après** la branche `ORD_*` (ligne 135) :
    - Réutilise la même logique de sécurité HMAC existante (lignes 105-128) — aucun nouveau mécanisme
    - Lookup booking : `.eq('transaction_id', cpm_trans_id)` sur la table `bookings`
    - **Idempotence** : si `deposit_status='paid'` ou `status='confirmed'` → retourner 200 sans mutation ni second message WhatsApp
    - Si `ACCEPTED` : `deposit_status = 'paid'`, `status = 'confirmed'`, `updated_at = now()`
    - Si `REFUSED/CANCELLED` : `deposit_status = 'expired'`, `updated_at = now()`
    - Si `PENDING/UNKNOWN` : aucune mutation, retourner 200 pour arrêter les retries
    - Envoyer confirmation WhatsApp au client (même pattern que la branche orders)
24. `src/lib/whatsapp/ai/tools/tool-restaurant.js` → dans `create_restaurant_checkout`, si `deposit_required && payment_method === 'online'` : appeler `booking-initiate` via un helper serveur (pas loopback HTTP si un helper partagé est disponible) et inclure `payment_link` dans le retour

### Phase 6c — Cron expiration acompte booking
> `jobs.js` traite uniquement les orders (`cancelExpiredOrders`, lignes 37-67). Les bookings avec acompte impayé restent en `deposit_status='pending'` ad vitam.

30. `src/lib/whatsapp/cron/jobs.js` → ajouter `cancelExpiredBookingDeposits` :
    - Requête : `bookings WHERE deposit_status='pending' AND deposit_required=true AND created_at < now() - interval '24h'`
    - Action : `deposit_status = 'expired'` (ne pas toucher à `status` — le marchand décide de l'annulation)
    - Message WhatsApp optionnel au client (même pattern que orders)
    - Appeler depuis le cron principal avec les autres fonctions

### Phase 8 — Tests
31. Tests unitaires `tool-restaurant.js`
32. Tests unitaires `restaurant-state.service.js`
33. Tests prompts (ne pas appeler `create_order`/`create_booking` directement)
34. Tests intégration mode par mode

### Matrice de tests — paiement acompte booking
35. `booking-initiate` : réservation avec `deposit_required=true` → reçoit `transaction_id` préfixé `BKG_*` et `payment_url` valide
36. `booking-initiate` idempotent : second appel sur même `booking_id` → retourne le même `transaction_id` sans ré-initier
37. Webhook `BKG_*` `ACCEPTED` → `deposit_status='paid'` + `status='confirmed'`
38. Webhook `BKG_*` `REFUSED/CANCELLED` → `deposit_status='expired'`
39. Webhook `BKG_*` idempotent : second appel sur booking déjà `deposit_status='paid'` → 200 sans double mutation ni double message WhatsApp
40. Webhook `BKG_*` `PENDING` → aucune mutation, 200
41. PATCH admin `deposit_status='paid'` sur booking `status='pending'` → `status='confirmed'` dans le même update
42. PATCH admin `deposit_status='waived'` → `status='confirmed'`
43. PATCH admin payload vide → 400
44. PATCH admin transition invalide `deposit_status='paid' → 'pending'` → 400

### Tests de non-régression
45. Webhook `ORD_*` : branche orders non affectée par l'ajout de la branche `BKG_*`
46. `create_order_with_items` : appel depuis `tool-orders.js:192` avec signature 11 paramètres — aucune régression
47. Lecture admin bookings avec filtre `booking_source='restaurant'` : ne retourne pas les events `booking_type='table'`
48. Moteur `event → TABLE` : inchangé après ajout de `restaurant → RESTAURANT` dans `SERVICE_ENGINE_MAP`

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

### UI dashboard marchand (`src/app/[locale]/dashboard/orders/page.tsx`)
- Ajouter filtre `pending_pickup` dans les stats
- Ajouter badge "En attente retrait" (orange)
- Ajouter transitions : `pending_pickup → confirmed → delivered`
- Inclure `pending_pickup` dans les compteurs de commandes actives

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

## Points intégrés — consensus 2 rounds d'audit croisé (2026-03-28)

| Point | Correction | Statut |
|---|---|---|
| status booking non écrit dans RPC → DEFAULT 'confirmed' même avec acompte impayé | `status = CASE WHEN p_deposit_required THEN 'pending' ELSE 'confirmed' END` — valeurs valides vérifiées en prod | ✅ Intégré |
| pending_pickup absent du dashboard marchand | Ajout Phase 6 item 20 + section dédiée dans "Support complet pending_pickup" | ✅ Intégré |
| payment_link absent du contrat tool output | Ajout `payment_link` + `deposit_status` dans output + règle de dérivation bot | ✅ Intégré |
| Phase 1 incomplète (RPC manquantes) | Phase 1 passe de 5 à 7 items (RPC booking + extension orders) | ✅ Intégré |
| SQL bookings non autonome (payment_method manquant) | `ADD COLUMN IF NOT EXISTS payment_method TEXT` ajouté avant le CHECK | ✅ Intégré |
| RPC non durcie contre p_items = null | `COALESCE(p_items, '[]'::jsonb)` aux 2 endroits dans la RPC | ✅ Intégré |
| Point 2 — Persistance restaurant sur bookings : `service_subtype` absent de `bookings` → requête SQL aveugle | Ajout `booking_source TEXT DEFAULT 'general'` + CHECK `restaurant\|general` dans bookings SQL + valeur `'restaurant'` écrite par la RPC | ✅ Intégré |
| Point 3 — `restaurantProducts` n'existe pas dans `message.js` (variables réelles : `orderableProducts`, `serviceProducts`) | Phase 4 item 13 corrigé : `serviceProducts.filter(p => p.service_subtype === 'restaurant')` — `prompt-builder.js` détecte déjà via `SERVICE_ENGINE_MAP` sans state séparé — règles d'intégration clarifiées | ✅ Intégré |

## Points intégrés — contre-audit 2026-03-28

| Point | Correction | Statut |
|---|---|---|
| B1 — Flux acompte online booking non bouclé : `payment_link` annoncé mais aucune route booking CinetPay ni branche webhook `BKG_*` | Ajout Phase 6b : route `booking-initiate`, branche webhook `BKG_*`, transitions `deposit_status` + `status` | ✅ Intégré |
| B2 — Acompte manuel non opérable : `admin/bookings/[id]/route.ts` n'accepte que `status`, jamais `deposit_status` | Phase 6 item 21 : PATCH étendu avec `deposit_status` (transitions `pending → paid \| waived \| expired`) + mise à jour `status → confirmed` si acompte payé | ✅ Intégré |
| B3 — Non-régression `create_order_with_items` : DROP de la signature prod casse `tool-orders.js:192` | Phase 1 item 7 : **nouvelle** RPC `create_restaurant_order_with_items` — DROP de l'existante interdit | ✅ Intégré |
| B4 — Exclusivité tool non verrouillée dans `generator.js` : Phase 4 item 14 ne précisait que le merge | Phase 4 item 14 complété : `RESTAURANT_DISABLED_TOOLS` pattern + Règles d'intégration mises à jour | ✅ Intégré |
| B5 — `CREATE POLICY IF NOT EXISTS` : syntaxe **absente du standard PostgreSQL** (non présente de PG 9.5 à PG 18, thread pgsql-hackers oct. 2025 en cours d'ajout). Présence dans `006_extend_subscription_plans.sql` ne prouve pas l'exécution prod. | Remplacé par pattern `DO $$ IF NOT EXISTS (SELECT 1 FROM pg_policies ...) THEN CREATE POLICY ... END IF; $$` — compatible toutes versions PostgreSQL | ✅ Intégré |
| `service_name` absent de la RPC `create_restaurant_booking` — admin et message confirmation affichent `null \|\| 'table'` au lieu du nom du restaurant (`bookings/[id]/status/route.ts:66`, `page.tsx:857`) | `p_service_name TEXT` ajouté à la signature RPC + `service_name` dans l'INSERT | ✅ Intégré |
| RLS `bookings`/`booking_items` en policy `ALL` implicite (pas de `FOR` clause) — autorise DELETE contrairement au pattern `orders` (`003_products_orders.sql:159`) | Scindé en 3 policies SELECT/INSERT/UPDATE + pas de DELETE policy — même choix intentionnel que orders | ✅ Intégré |
| Expiration acompte booking (`deposit_status: pending → expired`) documentée dans le plan mais aucun cron ne la déclenche — `jobs.js` ne traite que `orders` (ligne 37) | Phase 6c : `cancelExpiredBookingDeposits` ajouté dans `jobs.js` | ✅ Intégré |

## Points intégrés — corrections finales (checklist clôture)

| Point | Correction | Statut |
|---|---|---|
| `bookings.transaction_id` absent du schéma — Phase 6b y écrit, webhook BKG_* y fait un lookup | `ADD COLUMN IF NOT EXISTS transaction_id TEXT` + `CREATE INDEX idx_bookings_transaction_id` ajoutés dans `### 4. Bookings`. Note V1 : indexé, UNIQUE WHERE NOT NULL en V2. | ✅ Intégré |
| Idempotence `booking-initiate` renvoyait `existing_url` sans source de vérité persistée | Ajout `provider_payment_url TEXT` dans `### 4. Bookings` + Phase 6b réécrite pour écrire `transaction_id` **et** `provider_payment_url`, puis relire `bookings.provider_payment_url` en cas d'idempotence | ✅ Intégré |
| RPC 2 section SQL contredit Phase 1 item 7 (dit "étend create_order_with_items" alors que Phase 1 impose une nouvelle RPC) | Section RPC 2 réécrite : signature SQL complète de `create_restaurant_order_with_items` avec ses 18 paramètres, interdiction DROP explicite, GRANT | ✅ Intégré |
| Nouvelle RPC `create_restaurant_order_with_items` écrivait `line_total_fcfa` dans `order_items`, colonne absente du schéma prod actuel | Correction V1 non-régressive : `order_items` conserve seulement `quantity` + `unit_price_fcfa` (comme le schéma existant). `line_total_fcfa` reste stocké uniquement dans `booking_items`. | ✅ Intégré |
| `generator.js:394` — `create_restaurant_checkout` absent de la liste `directToolResponse` | Phase 4 item 14 complété : ajout de `'create_restaurant_checkout'` dans le tableau ligne 394 | ✅ Intégré |
| `prompt-builder.js:231` guard `&& false` non documenté — risque régression si retiré | Phase 3 item 9 : guard documenté, remplacement préconisé par `activeEngine !== 'RESTAURANT'` | ✅ Intégré |
| Filtre `booking_source='restaurant'` absent des lectures admin | Phase 6 item 19 : filtre documenté + champs minimum listés + référence `admin/bookings/route.ts` | ✅ Intégré |
| Contrat `booking-initiate` non verrouillé (entrée, sortie, idempotence, sécurité montant) | Phase 6b item 22 entièrement réécrit : entrée `booking_id` uniquement, montant depuis DB, sortie `{ success, payment_url, transaction_id }`, idempotence, endpoint non public | ✅ Intégré |
| Idempotence et transitions PENDING/UNKNOWN webhook BKG_* non documentées | Phase 6b item 23 : idempotence, transitions ACCEPTED/REFUSED/PENDING/UNKNOWN, `updated_at`, sécurité HMAC réutilisée | ✅ Intégré |
| PATCH admin bookings : guards insuffisants, `deposit_status='waived'` comportement non précisé | Phase 6 item 21 : rejet payload vide, transitions strictes, `waived → confirmed`, `updated_at` | ✅ Intégré |
| Matrice de tests incomplète — booking-initiate, BKG_*, ORD_* non-régression, booking_source absents | Phase 8 + matrice étendue : 14 nouveaux cas dont idempotence, non-régression, filtre booking_source | ✅ Intégré |
| Runbook de déploiement absent | Section "Runbook de déploiement" ajoutée : 6 étapes ordonnées + règle rollback | ✅ Intégré |
| Section "discorde non résolue" contenait un unique point déjà résolu | Section supprimée | ✅ Intégré |
| Header obsolète (statut + exploitable en production) | Mis à jour : statut = "En attente des 4 corrections bloquantes finales", exploitable = liste des 4 vrais bloquants restants au moment de cette checklist | ✅ Intégré |

---

## Runbook de déploiement

Ordre strict — chaque étape doit être validée avant la suivante pour ne pas casser la prod existante.

| Étape | Action | Validation |
|---|---|---|
| 1 | **Migrations SQL additives uniquement** : `products`, `agents`, `orders`, `bookings` (dont `transaction_id`), `booking_items`, RPC `create_restaurant_booking`, RPC `create_restaurant_order_with_items` | `SHOW server_version;` avant. Vérifier `SELECT relrowsecurity FROM pg_class WHERE relname='bookings'` après RLS. |
| 2 | **Paiement acompte** : déployer `booking-initiate` route + branche webhook `BKG_*` | Smoke test : créer une booking test, appeler `booking-initiate`, simuler un webhook `BKG_*` ACCEPTED. Vérifier que la branche `ORD_*` fonctionne toujours. |
| 3 | **Tool restaurant + routing** : déployer `tool-restaurant.js`, `generator.js` (RESTAURANT_DISABLED_TOOLS + directToolResponse), `prompt-builder.js` (SERVICE_ENGINE_MAP + guard :231), `message.js` | Tester end-to-end un flow restaurant complet en staging. |
| 4 | **Admin et dashboard** : déployer écrans `admin/bookings`, `admin/orders`, `dashboard/orders` | Vérifier l'affichage des nouveaux champs et le filtre `booking_source`. |
| 5 | **Tests smoke prod** : déclencher un flow `ORD_*` existant puis un flow `BKG_*` restaurant | Les deux doivent fonctionner indépendamment. |
| 6 | **Activation RESTAURANT** : basculer `SERVICE_ENGINE_MAP['restaurant']` de `'TABLE'` vers `'RESTAURANT'` | Seulement après validation étapes 1-5. |

> **Rollback** : toutes les migrations sont additives (`ADD COLUMN IF NOT EXISTS`, nouvelles RPC). Le rollback ne supprime jamais `create_order_with_items` ni ses colonnes. En cas d'urgence : désactiver le moteur RESTAURANT dans `SERVICE_ENGINE_MAP` sans toucher au SQL.

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

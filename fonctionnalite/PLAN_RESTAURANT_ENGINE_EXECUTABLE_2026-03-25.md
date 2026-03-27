# PLAN - Moteur Restaurant executable
**Date :** 2026-03-25  
**Statut :** Pret pour implementation technique  
**Portee :** Nouveau plan separe, sans modifier le plan original

---

## Objectif

Construire un moteur restaurant reellement executable dans ce codebase, en gardant:

- les items restaurant dans `products` avec `product_type = 'service'` et `service_subtype = 'restaurant'`
- les tables coeur existantes `orders`, `order_items`, `bookings`
- le runtime WhatsApp existant (`message.js`, `generator.js`, `tools.js`)

Le point cle est de **ne pas essayer de faire rentrer ce besoin dans le moteur TABLE actuel**.  
Le restaurant doit devenir un moteur dedie.

---

## Decisions verrouillees

1. `restaurant` ne doit plus partager le meme moteur que `event`.
2. Le moteur cible s'appelle `RESTAURANT`, pas `TABLE v2`.
3. Le panier restaurant ne passe ni par `cart-state.service.js` ni par `booking-state.service.js`.
4. Le checkout restaurant passe par **un tool dedie unique** qui route vers `orders` ou `bookings`.
5. `category` reste un champ d'affichage marchand, mais la logique produit s'appuie sur un champ canonique `menu_section_slug`.

---

## Contraintes reelles du codebase actuel

### Runtime actuel

- `prompt-builder.js` mappe aujourd'hui `restaurant -> TABLE`.
- `workflow-service-table.js` melange reservation sur place et livraison.
- `cart-state.service.js` exclut explicitement les produits `service`.
- `create_booking` ne sait creer qu'une reservation sur **un seul** `service_name`.
- `create_order` sait creer une commande multi-items, mais exige une logique de livraison/adresse qui ne couvre pas proprement `takeaway`.

### Schema actuel

- `products` existe deja avec `category` et `service_subtype`.
- `orders` et `order_items` existent deja.
- `bookings` existe deja avec `booking_type`, `preferred_date`, `preferred_time`, `party_size`, `end_date`, `payment_method`.
- Il n'existe pas de table `booking_items`.

### Conclusion technique

Le moteur restaurant doit:

- creer des `orders` pour `takeaway` et `delivery`
- creer des `bookings` pour `dine_in` et `booking_only`
- pouvoir associer un panier a une reservation `dine_in`

Donc il faut **ajouter un lien itemise pour les bookings** et **unifier le point d'entree tool**.

---

## Architecture cible

### Moteurs conversationnels

- `restaurant` -> nouveau moteur `RESTAURANT`
- `event` -> reste sur `TABLE`
- `hotel/residence` -> `STAY`
- `rental` -> `RENTAL`
- autres services -> inchanges

### Etats conversationnels

Nouveau service dedie:

- `src/lib/whatsapp/services/restaurant-state.service.js`

Ce service gere:

- menu principal
- navigation par section
- boissons
- recap intermediaire
- choix du mode (`dine_in`, `takeaway`, `delivery`, `booking_only`)
- collecte client
- recap final
- acompte si active

Il ne modifie pas le panier generique existant.

### Point d'entree tool

Nouveau tool:

- `create_restaurant_checkout`

Ce tool devient l'unique sortie outillee du moteur `RESTAURANT`.

Il route ensuite:

- vers `orders` + `order_items` si `takeaway` ou `delivery`
- vers `bookings` + `booking_items` si `dine_in` ou `booking_only`

---

## Schema de donnees cible

## 1. Products

On garde:

- `product_type = 'service'`
- `service_subtype = 'restaurant'`
- `category` comme libelle visible marchand

On ajoute:

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

### Regle metier

- `category` = libelle marchand libre affiche dans l'UI
- `menu_section_slug` = valeur canonique utilisee par le moteur

Exemple:

- `category = 'Entrees'`
- `menu_section_slug = 'starters'`

Cela evite de dependre d'un texte libre pour l'ordre de parcours.

---

## 2. Agents

On reutilise les champs de paiement existants:

- `payment_mode`
- `mobile_money_orange`
- `mobile_money_mtn`
- `mobile_money_wave`
- `custom_payment_methods`

On ajoute les champs specifiques restaurant:

```sql
ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_enabled BOOLEAN DEFAULT FALSE;

ALTER TABLE public.agents
    ADD COLUMN IF NOT EXISTS restaurant_deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.agents
    DROP CONSTRAINT IF EXISTS agents_restaurant_deposit_percentage_check;

ALTER TABLE public.agents
    ADD CONSTRAINT agents_restaurant_deposit_percentage_check
    CHECK (
        restaurant_deposit_percentage >= 0
        AND restaurant_deposit_percentage <= 100
    );
```

### V1 simplifiee

Pour V1:

- l'acompte est global au moteur restaurant
- il s'applique aux parcours qui aboutissent a une confirmation finale
- pas de granularite par mode dans cette premiere iteration

---

## 3. Orders

`orders` doit devenir explicite sur le mode de recuperation.

```sql
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS pickup_at TIMESTAMPTZ;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS payment_method TEXT;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';
```

Puis aligner la contrainte de statut:

```sql
ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
    ADD CONSTRAINT orders_status_check
    CHECK (
        status IN (
            'pending',
            'paid',
            'confirmed',
            'pending_pickup',
            'pending_delivery',
            'processing',
            'shipped',
            'delivered',
            'cancelled',
            'refunded'
        )
    );
```

### Regles

- `delivery` -> `delivery_address` obligatoire
- `takeaway` -> `pickup_at` obligatoire, `delivery_address` NULL
- `payment_method` stocke la valeur actuelle des commandes (`online` ou `cod`)

---

## 4. Bookings

`bookings` reste la table des reservations, mais il faut la rendre capable de porter une precommande restaurant.

```sql
ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_required BOOLEAN DEFAULT FALSE;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_amount_fcfa INTEGER DEFAULT 0;

ALTER TABLE public.bookings
    ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'not_required';
```

### Regles

- `booking_type = 'table'`
- `fulfillment_mode = 'dine_in'` pour reservation avec ou sans precommande
- `price_fcfa` porte le total de la precommande si des items existent, sinon `0`
- `payment_method` reste `online|onsite`

---

## 5. Nouvelle table booking_items

Sans cette table, une reservation restaurant avec precommande ne peut pas etre reconstruite proprement.

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
```

### Usage

- `booking_only` -> zero ligne
- `dine_in` avec precommande -> une ou plusieurs lignes

---

## Contrat tool cible

## Nouveau tool : `create_restaurant_checkout`

Ce tool remplace, pour le moteur restaurant uniquement, l'usage direct de `create_order` et `create_booking`.

### Input

```json
{
  "fulfillment_mode": "dine_in",
  "items": [
    {
      "product_name": "Thieboudienne",
      "quantity": 2
    },
    {
      "product_name": "Jus Bissap",
      "quantity": 2
    }
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

### Champs

- `fulfillment_mode`: `dine_in | takeaway | delivery | booking_only`
- `items`: liste d'items, vide autorise seulement pour `booking_only`
- `customer_name`: obligatoire
- `customer_phone`: obligatoire
- `scheduled_date`: obligatoire pour `dine_in`, `takeaway`, `booking_only`
- `scheduled_time`: obligatoire pour `dine_in`, `takeaway`, `booking_only`
- `party_size`: obligatoire pour `dine_in` et `booking_only`
- `delivery_address`: obligatoire pour `delivery`
- `payment_method`: input unifie `online | onsite`
- `notes`: optionnel

### Mapping interne

- `dine_in`
  - cree un `booking`
  - cree `booking_items` si `items.length > 0`
  - stocke `payment_method` en `online|onsite`

- `booking_only`
  - cree un `booking`
  - aucun `booking_item`

- `takeaway`
  - cree un `order`
  - cree `order_items`
  - mappe `payment_method`
    - `online` -> `online`
    - `onsite` -> `cod`
  - renseigne `pickup_at`

- `delivery`
  - cree un `order`
  - cree `order_items`
  - `delivery_address` obligatoire
  - mappe `payment_method`
    - `online` -> `online`
    - `onsite` -> `cod`

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
  "message": "Reservation enregistree..."
}
```

---

## Contrat de validation

### Validation catalogue

- tous les items doivent matcher des produits `service + restaurant`
- aucun produit hors restaurant dans ce moteur
- `quantity >= 1`
- item duplique -> fusion avant creation

### Validation mode

- V1: `booking_only` autorise seulement `items.length === 0`
- `dine_in` autorise avec ou sans items
- `takeaway` et `delivery` exigent `items.length > 0`

### Validation paiement

- input tool unifie: `online|onsite`
- mapping interne vers `orders.payment_method = online|cod`
- `bookings.payment_method` reste `online|onsite`

---

## State machine dediee

Nouveau fichier:

- `src/lib/whatsapp/services/restaurant-state.service.js`

### Stages

```js
RESTAURANT_MENU_HOME
RESTAURANT_SECTION
RESTAURANT_DRINKS
RESTAURANT_MODE
RESTAURANT_CUSTOMER_FLOW
RESTAURANT_RECAP
RESTAURANT_DEPOSIT
```

### Etat minimal

```js
{
  stage: 'RESTAURANT_SECTION',
  section_slug: 'mains',
  section_order: ['starters', 'mains', 'extras', 'desserts'],
  drinks_enabled: true,
  cart_items: [
    {
      product_id: 'uuid',
      product_name: 'Thieboudienne',
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

### Regles d'integration

- le state restaurant vit dans `conversation.metadata.restaurant`
- il est prioritaire sur `cart`, `checkout`, `booking` quand un flow restaurant est actif
- il doit etre merge dans `generator.js` comme les autres state services

---

## Fichiers a creer ou modifier

## 1. Prompt routing

- `src/lib/whatsapp/ai/prompt-builder.js`
  - `restaurant -> RESTAURANT`
  - `event -> TABLE`

## 2. Prompt moteur

- nouveau `src/lib/whatsapp/ai/prompts/workflow-service-restaurant.js`
- conserver `workflow-service-table.js` pour les cas `event`

## 3. Sections prompt

- `src/lib/whatsapp/ai/prompts/sections.js`
  - ajouter `buildRestaurantMenuSection(products)`
  - grouper par `menu_section_slug`
  - afficher `category` si renseignee, sinon label par defaut du slug

## 4. State runtime

- nouveau `src/lib/whatsapp/services/restaurant-state.service.js`
- modifier `src/lib/whatsapp/handlers/message.js`
  - detecter `restaurantProducts`
  - executer le state restaurant avant les flows generiques
- modifier `src/lib/whatsapp/ai/generator.js`
  - merge `restaurant` state dans les args tool
  - ajouter la guidance du moteur restaurant

## 5. Tools

- `src/lib/whatsapp/ai/tools/definitions.js`
  - ajouter `create_restaurant_checkout`
- nouveau `src/lib/whatsapp/ai/tools/tool-restaurant.js`
  - resolution catalogue
  - calcul total
  - creation booking/order
  - creation booking_items/order_items
  - calcul acompte
- `src/lib/whatsapp/ai/tools.js`
  - branch de dispatch pour `create_restaurant_checkout`

## 6. UI produits

- `src/app/[locale]/dashboard/products/new/page.tsx`
- `src/app/[locale]/dashboard/products/[id]/page.tsx`
- ajouter:
  - select `menu_section_slug` si `service_subtype === 'restaurant'`
  - champ `category` garde comme libelle visible
  - champ `menu_sort_order`

## 7. UI agents

- `src/app/[locale]/dashboard/agents/new/page.tsx`
- `src/app/[locale]/dashboard/agents/[id]/page.tsx`
- ajouter:
  - `restaurant_deposit_enabled`
  - `restaurant_deposit_percentage`

## 8. Admin / lecture

- `src/app/[locale]/admin/bookings/page.tsx`
- `src/app/[locale]/admin/orders/page.tsx`
- afficher:
  - `fulfillment_mode`
  - acompte
  - items lies a une reservation restaurant

---

## Ordre d'implementation corrige

## Phase 1 - Schema

1. Migration `products` pour `menu_section_slug` et `menu_sort_order`
2. Migration `agents` pour acompte restaurant
3. Migration `orders` pour `fulfillment_mode`, `pickup_at`, `payment_method` si absent, statuts et acompte
4. Migration `bookings` pour `fulfillment_mode` et acompte
5. Creation `booking_items`

**Sortie attendue:** base compatible avec les 4 modes restaurant.

## Phase 2 - Tooling

6. Ajouter `create_restaurant_checkout` dans `definitions.js`
7. Creer `tool-restaurant.js`
8. Brancher le dispatch dans `tools.js`

**Sortie attendue:** contrat outille stable, testable hors IA.

## Phase 3 - Routing moteur

9. Changer le mapping `restaurant -> RESTAURANT`
10. Conserver `TABLE` pour `event`
11. Creer `workflow-service-restaurant.js`
12. Ajouter `buildRestaurantMenuSection`

**Sortie attendue:** prompt coherent avec le contrat tool.

## Phase 4 - State machine

13. Creer `restaurant-state.service.js`
14. Integrer le state dans `message.js`
15. Integrer le merge dans `generator.js`

**Sortie attendue:** conversation restaurant pilotable sans casser `cart` ni `booking`.

## Phase 5 - UI

16. Ajouter les champs restaurant sur le wizard produit
17. Ajouter la config acompte sur le wizard agent

**Sortie attendue:** un marchand peut configurer seul son menu et son acompte.

## Phase 6 - Lecture / admin

18. Afficher `fulfillment_mode`, acompte et items dans les pages admin
19. Verifier la compatibilite avec les pages ordre/reservation existantes

## Phase 7 - Tests

20. Tests unitaires tool
21. Tests unitaires state machine
22. Tests prompts
23. Tests integration mode par mode

---

## Matrice de tests minimale

### Tool

- `dine_in + items` -> cree `booking + booking_items`
- `booking_only` -> cree `booking` sans items
- `takeaway` -> cree `order + order_items + pickup_at`
- `delivery` -> refuse sans adresse
- acompte active -> calcule `deposit_amount_fcfa`
- `payment_method=onsite` -> mappe vers `cod` pour `orders`

### State machine

- entree par "Notre Carte"
- entree directe par "Boissons"
- entree directe par "Reserver une table"
- `modifier plats`
- categorie vide sautee automatiquement
- recap intermediaire avant boissons

### Prompt

- ne pas appeler `create_order` ou `create_booking` directement depuis le moteur restaurant
- appeler uniquement `create_restaurant_checkout`
- ne pas demander d'adresse hors mode `delivery`

---

## Hors scope V1

- frais de livraison dynamiques
- gestion des zones de livraison
- stock temps reel par tranche horaire
- split payment
- acompte different selon le mode
- recommandations automatiques upsell

---

## Verdict technique

Ce plan est executable dans ce repo parce qu'il:

- respecte les tables existantes
- assume les manques reels (`booking_items`, `fulfillment_mode`, tool unique)
- evite de surcharger `cart-state.service.js`
- separe proprement `restaurant` de `event`

Si une seule chose doit etre retenue avant implementation:

**ne pas faire un "TABLE v2". Il faut un moteur `RESTAURANT` dedie avec un tool `create_restaurant_checkout` dedie.**

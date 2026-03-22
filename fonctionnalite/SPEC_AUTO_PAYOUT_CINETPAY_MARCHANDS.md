# Specification Technique - Auto Payout CinetPay Marchands

Date: 2026-03-15
Projet: WazzapAI
Statut: Document de conception, pas encore implemente

## 1. Objectif

Remplacer le modele actuel:

- client paie via CinetPay
- la plateforme recoit l'argent
- l'admin reverse ensuite manuellement au marchand

par un modele automatise:

- client paie via CinetPay
- le paiement commande est confirme par webhook
- le systeme calcule automatiquement la part plateforme et la part marchand
- le systeme envoie automatiquement le net marchand vers le Mobile Money du marchand via l'API transfert CinetPay
- l'admin garde un droit de supervision et de reprise, mais ne fait plus le reversement a la main dans le flux normal

## 2. Contexte actuel du code

### 2.1 Ce qui existe deja

- Paiement CinetPay commande:
  - [src/app/api/public/orders/[orderId]/pay/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\public\orders\[orderId]\pay\route.ts)
- Webhook CinetPay paiement:
  - [src/app/api/payments/cinetpay/webhook/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\payments\cinetpay\webhook\route.ts)
- Mode manuel Mobile Money direct par agent:
  - [src/app/[locale]/dashboard/agents/[id]/page.tsx](h:\WHATSAPP\wazzap-clone\src\app\[locale]\dashboard\agents\[id]\page.tsx)
  - [src/lib/whatsapp/ai/tools/tool-orders.js](h:\WHATSAPP\wazzap-clone\src\lib\whatsapp\ai\tools\tool-orders.js)
- Table admin de reversements manuels:
  - [supabase/migrations/20260220_payouts.sql](h:\WHATSAPP\wazzap-clone\supabase\migrations\20260220_payouts.sql)
  - [src/app/api/admin/payouts/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\admin\payouts\route.ts)

### 2.2 Limites actuelles

- Le reversement marchand est encore un processus admin manuel.
- Le module `payouts` est pense comme un historique de reversement, pas comme un moteur complet de payout automatique.
- Le calcul des "balances marchands" de l'admin repose actuellement sur `payments`, alors que les paiements commandes doivent etre suivis plus proprement.
- Il n'existe pas encore de profil de reversement marchand par utilisateur.
- Il n'existe pas encore de ledger marchand robuste pour l'argent collecte, la commission, et les reversements.

## 3. Decision d'architecture

### 3.1 Source de configuration payout

La configuration de reversement doit etre portee par l'utilisateur marchand, pas par chaque agent.

Modele retenu:

- 1 utilisateur marchand = 1 profil de reversement principal
- N agents pour ce meme utilisateur = meme destination payout par defaut

Ce choix est recommande car:

- plus simple a configurer
- plus stable en production
- plus coherent avec les reversements reels
- evite de dupliquer des numeros Mobile Money sur plusieurs agents

### 3.2 Niveaux fonctionnels

- Niveau agent:
  - `payment_mode = 'cinetpay'`
  - `payment_mode = 'mobile_money_direct'`
- Niveau utilisateur:
  - profil de reversement CinetPay automatique

### 3.3 Comportement metier vise

Si un agent est en mode `cinetpay`:

- le client paie via CinetPay
- la commande payee alimente la comptabilite marchand
- si le marchand a un profil payout valide et actif, le reversement est programme automatiquement
- sinon les fonds restent en attente dans un etat supervise par l'admin

## 4. Modele de donnees cible

## 4.1 Nouvelle table `merchant_payout_profiles`

But:

- stocker la destination payout du marchand
- suivre son etat de synchronisation CinetPay
- controler le mode de reversement automatique

Schema recommande:

```sql
create table if not exists public.merchant_payout_profiles (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null unique references public.profiles(id) on delete cascade,
    provider text not null default 'cinetpay',
    enabled boolean not null default false,
    auto_payout_enabled boolean not null default false,
    payout_mode text not null default 'daily_batch',
    minimum_payout_amount integer not null default 0,
    country_prefix text,
    phone text,
    payment_method text,
    first_name text,
    last_name text,
    email text,
    contact_registered boolean not null default false,
    contact_sync_status text,
    contact_sync_error text,
    provider_recipient_id text,
    last_contact_sync_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint merchant_payout_profiles_payout_mode_check
        check (payout_mode in ('instant', 'daily_batch', 'manual_hold'))
);
```

Indexes:

- `unique(user_id)`
- index `(enabled, auto_payout_enabled)`

## 4.2 Nouvelle table `merchant_balance_ledger`

But:

- suivre la comptabilite marchand de maniere fiable
- ne pas recalculer les soldes a partir de tables heterogenes

Principe:

- tout mouvement d'argent marchand cree une ecriture
- le solde marchand disponible est la somme du ledger

Schema recommande:

```sql
create table if not exists public.merchant_balance_ledger (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    order_id uuid null references public.orders(id) on delete set null,
    payout_id uuid null references public.payouts(id) on delete set null,
    entry_type text not null,
    amount_fcfa integer not null,
    currency text not null default 'XOF',
    provider text,
    provider_reference text,
    client_reference text,
    metadata jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint merchant_balance_ledger_entry_type_check
        check (entry_type in (
            'order_collected',
            'commission_reserved',
            'payout_sent',
            'payout_reversed',
            'refund',
            'adjustment'
        ))
);
```

Indexes:

- `idx_mbl_user_id`
- `idx_mbl_order_id`
- `idx_mbl_payout_id`
- `idx_mbl_created_at`

## 4.3 Extension de la table `payouts`

But:

- garder la table existante
- l'etendre pour les reversements automatiques CinetPay

Colonnes a ajouter:

```sql
alter table public.payouts
    add column if not exists payout_profile_id uuid references public.merchant_payout_profiles(id),
    add column if not exists trigger_source text default 'manual',
    add column if not exists provider text default 'cinetpay',
    add column if not exists provider_transaction_id text,
    add column if not exists client_transaction_id text,
    add column if not exists lot text,
    add column if not exists sending_status text,
    add column if not exists treatment_status text,
    add column if not exists operator_transaction_id text,
    add column if not exists provider_response jsonb,
    add column if not exists notify_payload jsonb,
    add column if not exists retry_count integer not null default 0,
    add column if not exists next_retry_at timestamptz,
    add column if not exists failed_at timestamptz,
    add column if not exists failure_reason text,
    add column if not exists order_ids jsonb not null default '[]'::jsonb;
```

Contrainte:

```sql
alter table public.payouts
    add constraint payouts_trigger_source_check
    check (trigger_source in ('manual', 'auto', 'retry'));
```

## 4.4 Mise a jour des types TypeScript

Fichier a mettre a jour:

- [src/types/database.ts](h:\WHATSAPP\wazzap-clone\src\types\database.ts)

Ajouter:

- `merchant_payout_profiles`
- `merchant_balance_ledger`
- colonnes etendues de `payouts`

## 5. Flux metier cible

## 5.1 Configuration payout marchand

### Etape utilisateur

Le marchand renseigne:

- prenom
- nom
- email
- indicatif pays
- numero Mobile Money
- operateur / methode
- mode de reversement
- seuil minimum

### Etape backend

Le serveur:

1. valide les donnees
2. cree ou met a jour `merchant_payout_profiles`
3. tente la synchronisation du contact avec CinetPay
4. stocke le resultat de cette synchronisation

### Etat de sortie

Le profil payout peut etre:

- `non_configure`
- `configure_non_sync`
- `contact_registered`
- `contact_error`
- `auto_ready`

## 5.2 Paiement client d'une commande

Flux:

1. le client paie via CinetPay
2. [src/app/api/payments/cinetpay/webhook/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\payments\cinetpay\webhook\route.ts) confirme le paiement
3. la commande est marquee `paid`
4. le systeme cree:
   - une ecriture `order_collected`
   - une ecriture `commission_reserved`
5. le systeme decide s'il faut creer un payout automatique
6. si oui, un payout `pending` est cree
7. un worker distinct execute ensuite le transfert

## 5.3 Execution du reversement

Flux:

1. le worker charge un payout `pending`
2. il recharge le profil payout utilisateur
3. il verifie les preconditions:
   - profil actif
   - contact CinetPay sync
   - seuil minimum atteint
   - montant positif
4. il appelle l'API transfert CinetPay
5. il enregistre la reponse
6. le payout passe en `processing`

## 5.4 Notification de transfert

Flux:

1. CinetPay appelle un `notify_url` dedie au transfert
2. le webhook payout retrouve le reversement
3. il stocke le payload
4. il confirme si necessaire l'etat via l'API CinetPay
5. si le transfert est valide:
   - `status = completed`
   - `paid_at` renseigne
   - ecriture `payout_sent` dans le ledger
6. sinon:
   - `status = processing` ou `pending` ou `cancelled`
   - `failure_reason` alimente
   - retry eventuel programme

## 6. Endpoints cibles

## 6.1 Endpoints utilisateur

### `GET /api/payout-profile`

Retourne:

- le profil payout du user
- l'etat de synchro contact
- l'etat auto payout
- le mode de reversement

### `PATCH /api/payout-profile`

Met a jour:

- `first_name`
- `last_name`
- `email`
- `country_prefix`
- `phone`
- `payment_method`
- `enabled`
- `auto_payout_enabled`
- `payout_mode`
- `minimum_payout_amount`

Validation:

- user authentifie
- admin exclus ou lecture seule selon politique
- numero valide
- methode supportee

### `POST /api/payout-profile/register-contact`

Force:

- la creation ou mise a jour du contact payout chez CinetPay

### `GET /api/payouts`

Historique utilisateur:

- reversements
- montants
- statuts
- references

## 6.2 Endpoints internes

### `POST /api/internal/payouts/queue-order`

Role:

- a partir d'une commande payee, creer les ecritures ledger
- creer le payout `pending` si applicable

### `POST /api/internal/payouts/process`

Role:

- prendre les payouts `pending`
- executer l'appel API transfert CinetPay

### `POST /api/internal/payouts/reconcile`

Role:

- re-verifier les payouts `processing`
- corriger les statuts si `notify_url` a ete manque

## 6.3 Endpoints CinetPay

### `POST /api/payments/cinetpay/transfer/webhook`

Role:

- recevoir les notifications de transfert
- mettre a jour `payouts`
- ecrire dans le ledger si succes

## 6.4 Endpoints admin

### Reutiliser

- [src/app/api/admin/payouts/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\admin\payouts\route.ts)
- [src/app/api/admin/payouts/[id]/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\admin\payouts\[id]\route.ts)

### A faire evoluer

- baser les soldes admin sur `merchant_balance_ledger`
- enrichir les historiques avec les statuts CinetPay
- conserver l'action manuelle admin comme filet de securite

## 7. Services backend a creer

## 7.1 `src/lib/payments/cinetpay-transfer.ts`

Responsabilites:

- encapsuler l'API transfert CinetPay
- enregistrer un contact
- envoyer un transfert
- verifier un statut transfert
- normaliser les erreurs

Fonctions recommandees:

- `registerTransferContact(profile)`
- `sendTransfer(payout, profile)`
- `getTransferStatus({ providerTransactionId, clientTransactionId })`

## 7.2 `src/lib/payments/merchant-payouts.ts`

Responsabilites:

- calcul commission / net
- gerer le ledger marchand
- creer les reversements auto
- idempotence par commande
- suivi du solde disponible

Fonctions recommandees:

- `queueOrderPayout(orderId)`
- `createLedgerEntriesForPaidOrder(order)`
- `createAutomaticPayout(order, payoutProfile)`
- `getMerchantAvailableBalance(userId)`
- `markPayoutCompleted(payoutId, providerPayload)`
- `markPayoutFailed(payoutId, reason, retryAt?)`

## 7.3 `src/lib/payments/payout-jobs.ts`

Responsabilites:

- process des payouts `pending`
- retry des echecs
- reconciliation des `processing`

Fonctions recommandees:

- `processPendingPayouts()`
- `retryFailedPayouts()`
- `reconcileProcessingPayouts()`

## 8. Points d'integration precis dans le code existant

## 8.1 Webhook paiement commande

Fichier:

- [src/app/api/payments/cinetpay/webhook/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\payments\cinetpay\webhook\route.ts)

Changement cible:

- apres confirmation commande `ORD_...`, appeler la logique de queue payout
- ne pas faire le transfert directement dans le webhook

Pourquoi:

- webhook plus robuste
- meilleure idempotence
- meilleure observabilite

## 8.2 Admin payouts

Fichier:

- [src/app/api/admin/payouts/route.ts](h:\WHATSAPP\wazzap-clone\src\app\api\admin\payouts\route.ts)

Limite actuelle:

- les balances sont calculees depuis `payments.payment_type = 'one_time'`

Correction cible:

- les balances doivent etre calculees depuis `merchant_balance_ledger`
- ou a defaut `orders paid - payouts completed - commissions`

## 8.3 Agent payment mode

Fichier:

- [src/app/[locale]/dashboard/agents/[id]/page.tsx](h:\WHATSAPP\wazzap-clone\src\app\[locale]\dashboard\agents\[id]\page.tsx)

Decision:

- conserver `payment_mode = 'cinetpay'`
- conserver `payment_mode = 'mobile_money_direct'`

Mais ajouter:

- warning si `payment_mode = 'cinetpay'` et profil payout utilisateur non pret
- possibilite de `manual_hold` tant que le profil payout n'est pas valide

## 9. UI cible

## 9.1 Espace utilisateur

Ajouter un module:

- `Dashboard > Parametres > Paiement`

ou

- `Dashboard > Reversements`

Contenu:

- activer les reversements automatiques
- numero Mobile Money
- operateur
- nom / prenom / email
- mode:
  - instant
  - batch journalier
  - hold manuel
- seuil minimum
- statut contact CinetPay
- statut derniere tentative
- historique reversements

## 9.2 Espace admin

Page:

- [src/app/[locale]/admin/payouts/page.tsx](h:\WHATSAPP\wazzap-clone\src\app\[locale]\admin\payouts\page.tsx)

A ajouter:

- filtre `auto` / `manual`
- statut CinetPay
- references transfert
- erreurs de transfert
- action retry
- statut profil payout marchand

## 10. Idempotence et securite

## 10.1 Idempotence commande

Une commande payee ne doit creer qu'une seule fois:

- `order_collected`
- `commission_reserved`
- payout `pending`

Strategie:

- verifier si des ecritures ledger existent deja sur `order_id`
- ou contrainte logique via `metadata.order_id`

## 10.2 Idempotence payout

Un meme `client_transaction_id` payout ne doit pas etre rejoue.

Strategie:

- `client_transaction_id` unique logique
- rechecks avant resend

## 10.3 Verification webhook

Comme pour le webhook payin:

- valider signature / secret si applicable
- faire du fail-closed
- re-verifier l'etat si necessaire via l'API fournisseur

## 10.4 Retries

Champs:

- `retry_count`
- `next_retry_at`
- `failure_reason`

Politique recommandee:

- retry exponentiel leger
- plafond de tentatives
- passage en manuel si echec persistant

## 11. Politique metier recommandee

## 11.1 Ne pas lancer l'instant payout au jour 1

Mode recommande pour la V1:

- `auto_payout_enabled = true`
- `payout_mode = daily_batch`
- `minimum_payout_amount > 0`

Pourquoi:

- moins de bruit
- moins de frais
- meilleure reconciliation
- plus simple a surveiller

## 11.2 Conserver `mobile_money_direct` comme fallback

Ne pas supprimer tout de suite le mode manuel direct.

Usage:

- fallback operateur
- fallback pays non supporte
- fallback incident CinetPay transfert

## 12. Variables d'environnement cibles

Ajouter ou clarifier:

- `CINETPAY_API_KEY`
- `CINETPAY_SITE_ID`
- `CINETPAY_SECRET_KEY`
- `CINETPAY_TRANSFER_API_KEY`
- `CINETPAY_TRANSFER_BASE_URL`
- `CINETPAY_TRANSFER_NOTIFY_URL`
- `CINETPAY_TRANSFER_IP_WHITELIST_ENABLED`

Note:

- selon le compte CinetPay, certaines cles peuvent etre les memes
- mais le code doit separer clairement checkout et transfert

## 13. Strategie de migration

## Phase 1 - Schema et types

1. migration `merchant_payout_profiles`
2. migration `merchant_balance_ledger`
3. migration extension `payouts`
4. mise a jour [src/types/database.ts](h:\WHATSAPP\wazzap-clone\src\types\database.ts)

## Phase 2 - Profil payout user

5. `GET /api/payout-profile`
6. `PATCH /api/payout-profile`
7. `POST /api/payout-profile/register-contact`
8. UI utilisateur de configuration payout

## Phase 3 - Moteur payout

9. `src/lib/payments/cinetpay-transfer.ts`
10. `src/lib/payments/merchant-payouts.ts`
11. webhook commande -> queue payout
12. worker `processPendingPayouts`

## Phase 4 - Notifications et reconciliation

13. webhook transfert payout
14. retries
15. reconciliation `processing`

## Phase 5 - Admin

16. refonte calcul balances admin sur ledger
17. enrichissement UI admin reversements

## 14. Risques

## Faible risque

- nouvelles tables
- types TS
- ecran utilisateur de configuration payout

## Risque moyen

- creation automatique du payout depuis le webhook commande
- execution worker transfert
- webhook transfert payout

## Risque eleve si mal concu

- transfert direct dans le webhook client
- absence d'idempotence
- calcul admin sur mauvaises tables
- reversement instantane sans reconciliation

## 15. Critere de validation

La fonctionnalite sera consideree validee si:

1. un utilisateur configure une fois son profil payout
2. son contact payout CinetPay est cree avec succes
3. une commande payee via CinetPay cree bien:
   - commande `paid`
   - ecriture `order_collected`
   - ecriture `commission_reserved`
   - payout `pending`
4. le worker envoie le payout CinetPay sans doublon
5. le webhook payout confirme le statut reel
6. le ledger contient une ecriture `payout_sent`
7. l'admin voit les references et les statuts
8. l'utilisateur voit son historique de reversement

## 16. Decision finale recommandee

Pour WazzapAI, la meilleure trajectoire est:

- conserver CinetPay pour le payin
- ajouter un vrai profil payout marchand par utilisateur
- ajouter un ledger marchand
- automatiser le reversement via CinetPay transfert
- garder `mobile_money_direct` comme mode fallback, pas comme flux principal cible

Cette approche permet:

- d'eliminer le reversement manuel dans le flux normal
- de rester compatible avec la prod actuelle
- d'eviter une migration paiement trop brutale
- d'avoir une vraie base technique pour monter ensuite en volume


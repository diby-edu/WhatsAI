# PLAN API PUBLIQUE WAZZAPAI — 2026-04-04

## VISION

WazzapAI expose une API REST universelle permettant à n'importe quelle plateforme externe
(Shopify, WooCommerce, Zapier, scripts custom) d'orchestrer des conversations WhatsApp intelligentes.

L'API est structurée en 3 tiers fonctionnels :

```
API WazzapAI (unique)
├── Trigger API     → déclencher une action (relance, notification, alerte)
├── Data Sync API   → synchroniser les données métier (produits, clients, catalogue)
└── Live Query API  → interroger une source externe en temps réel pendant la conversation
```

## ARCHITECTURE BASE DE DONNÉES

### Tables créées

| Table | Rôle | Migration |
|---|---|---|
| `api_keys` | Clés API des utilisateurs | 20260404_api_keys.sql |
| `api_usage_logs` | Log de chaque appel API | 20260404_api_keys.sql |
| `api_webhooks` | Webhooks sortants configurés | 20260404_api_keys.sql |
| `api_idempotency` | Déduplication des appels | 20260405_api_trigger.sql |
| `agent_external_data` | Données synchronisées (Data Sync) | 20260406_agent_external_data.sql |

### Colonnes ajoutées sur tables existantes

- `agents.live_query_url` TEXT DEFAULT NULL
- `agents.live_query_secret` TEXT DEFAULT NULL

## ENDPOINTS IMPLÉMENTÉS

### API Publique (`/api/public/v1/`)

| Méthode | Endpoint | Tier | Statut |
|---|---|---|---|
| POST | `/send` | Trigger (bas niveau) | Implémenté |
| POST | `/trigger` | Trigger (événements typés) | Implémenté |
| POST/DELETE | `/sync` | Data Sync (upsert + suppression) | Implémenté |
| GET | `/status` | Statut WhatsApp de l'agent | Implémenté |
| GET | `/conversations` | Lister les conversations | Implémenté |
| GET | `/conversation` | Détail conversation + messages | Implémenté |

### API Développeur (`/api/developer/`)

| Méthode | Endpoint | Rôle | Statut |
|---|---|---|---|
| GET/POST | `/keys` | Lister / créer des clés | Implémenté |
| PATCH/DELETE | `/keys/[id]` | Modifier / supprimer une clé | Implémenté |
| GET | `/logs` | Logs d'usage | Implémenté |
| GET/POST | `/webhooks` | Gérer les webhooks sortants | Implémenté |
| PATCH/DELETE | `/webhooks/[id]` | Modifier / supprimer un webhook | Implémenté |

## AUTHENTIFICATION

Système SHA256 — la clé brute n'est jamais stockée :

```
Clé générée      : sk_live_abc123xyz...   (montrée une seule fois à l'utilisateur)
Stockée en DB    : SHA256(sk_live_abc123xyz...)
Vérification     : SHA256(clé reçue) === hash stocké
```

Format Bearer : `Authorization: Bearer sk_live_xxxx`

## SÉCURITÉ

- Clé stockée uniquement en SHA256
- RLS Supabase sur toutes les tables API
- Idempotence via table `api_idempotency` (unicité user_id + idempotency_key)
- Rate limiting 3 niveaux : par clé, par user, par numéro de téléphone
- Signature HMAC-SHA256 sur les webhooks sortants

## RATE LIMITING

| Niveau | Limite par défaut |
|---|---|
| Par clé API | 60 req/min (configurable) |
| Par utilisateur | 200 req/min |
| Par numéro de téléphone | 5 messages / 24h |

Headers retournés :
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1712345678
```

## LIVE QUERY — ARCHITECTURE

L'agent peut interroger un système externe en temps réel pendant une conversation.

Configuration dans l'agent :
- `live_query_url` : URL du système client à appeler
- `live_query_secret` : secret pour signature HMAC-SHA256

Flow :
1. Client envoie un message ("Où est ma commande ?")
2. Avant de générer la réponse IA, WazzapAI appelle `live_query_url`
3. Timeout strict : 3 secondes
4. Si timeout/erreur → l'agent répond avec les données connues (fail silencieux)
5. Si succès → la réponse est injectée dans le contexte de l'agent

## PHASES D'IMPLÉMENTATION

### Phase 1 — Socle API (Terminée)
- Authentification (public-auth.ts)
- Rate limiting (rate-limit-public.ts)
- Log d'usage (log-usage.ts)
- POST /send

### Phase 2 — Dashboard Développeur (Terminée)
- GET/POST /api/developer/keys
- PATCH/DELETE /api/developer/keys/[id]
- GET /api/developer/logs
- Page /dashboard/developers

### Phase 3 — Trigger API (Terminée)
- POST /trigger (événements typés : cart_abandoned, order_created, etc.)
- Idempotency key
- Context structuré stocké dans conversations.metadata

### Phase 4 — Data Sync API (Terminée)
- Table agent_external_data
- POST /sync (upsert produits/clients/catalogue)

### Phase 5 — Live Query API (Terminée)
- live_query_url sur l'agent
- Appel sortant dans generator.js (3s timeout, HMAC, fail silencieux)

### Addendum 2026-04-20

- Nouveau endpoint entrant implemente : `POST /api/public/v1/platform-webhook`
- Role : ingestion webhook plateforme (Shopify, WooCommerce, Chariow, Maketou, generic)
- Comportement : normalise le payload, mappe un evenement trigger, puis envoie via la queue outbound.

## DASHBOARDS

### Utilisateur — /dashboard/developers
- Gestion des clés API (créer, activer/désactiver, supprimer)
- Affichage one-shot de la clé brute
- Logs d'usage en temps réel
- Guide de démarrage rapide intégré

### Admin — /admin/api-monitoring (Implémenté)
- Vue d'ensemble : stats globales, volume/jour, top utilisateurs, taux d'erreur
- Accès utilisateurs : toggle individuel + bulk, filtres
- Clés API : liste toutes clés, révocation admin
- Logs : 100 derniers appels globaux
- Kill switch global (feature_flag api_public_enabled)

## FICHIERS CLÉS

```
src/lib/api/
├── public-auth.ts          Authentification via SHA256
├── rate-limit-public.ts    Rate limiting 3 niveaux
└── log-usage.ts            Log fire-and-forget

src/app/api/public/v1/
├── send/route.ts
├── trigger/route.ts
├── sync/route.ts
├── status/route.ts
├── conversations/route.ts
└── conversation/route.ts

src/app/api/developer/
├── keys/route.ts
├── keys/[id]/route.ts
├── logs/route.ts
├── webhooks/route.ts
└── webhooks/[id]/route.ts

src/app/api/admin/
├── api-stats/route.ts
├── api-keys-admin/route.ts
├── api-keys-admin/[id]/route.ts
├── api-logs-admin/route.ts
└── api-users-access/route.ts

src/app/[locale]/dashboard/developers/page.tsx
src/app/[locale]/admin/api-monitoring/page.tsx

supabase/migrations/
├── 20260404_api_keys.sql
├── 20260405_api_trigger.sql
├── 20260406_agent_external_data.sql
└── 20260407_api_access_control.sql
```

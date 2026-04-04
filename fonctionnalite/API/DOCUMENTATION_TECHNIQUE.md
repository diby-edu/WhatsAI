# DOCUMENTATION TECHNIQUE — API WAZZAPAI

Base URL : `https://votre-domaine.com`
Version : `v1`
Format : JSON exclusivement

---

## AUTHENTIFICATION

Toutes les requêtes doivent inclure un header `Authorization` avec une clé Bearer.

```
Authorization: Bearer sk_live_VOTRE_CLE_API
```

La clé est générée depuis le dashboard → API → Nouvelle clé.
Elle n'est affichée qu'une seule fois à la création. En cas de perte, créer une nouvelle clé.

**Contrôle d'accès :**
- Si `api_public_enabled = false` (kill switch admin) → `503` pour tous
- Si `profiles.api_access_enabled = false` (accès non activé) → `403` pour cet utilisateur
- Si la clé est révoquée ou expirée → `401`

---

## TIER 1 — TRIGGER API

### POST /api/public/v1/send

**Rôle :** envoyer un message WhatsApp simple depuis un agent.

**Body :**
```json
{
  "agent_id": "uuid-de-votre-agent",
  "to": "+22507000000",
  "message": "Bonjour Awa, votre commande #1234 est expédiée.",
  "idempotency_key": "commande-1234-notif-expedition",
  "context": {
    "event": "order_shipped",
    "order": { "id": "1234", "total": 18000 }
  },
  "metadata": { "source": "shopify", "campaign": "retention" }
}
```

| Champ | Type | Obligatoire | Description |
|---|---|---|---|
| `agent_id` | string | Oui | UUID de l'agent |
| `to` | string | Oui | Numéro international (`+22507000000`) |
| `message` | string | Oui | Texte du message |
| `idempotency_key` | string | Non | Déduplication sur 24h |
| `context` | object | Non | Contexte métier stocké dans la conversation |
| `metadata` | object | Non | Métadonnées libres (non affichées au client) |

**Réponse succès (200) :**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "conversation_id": "conv_uuid",
    "status": "sent",
    "sent_at": "2026-04-04T10:00:00Z"
  }
}
```

---

### POST /api/public/v1/trigger

**Rôle :** déclencher un événement métier typé. WazzapAI génère le message automatiquement et stocke le contexte pour toute la durée de la conversation.

**Événements supportés :**

| event | Description |
|---|---|
| `cart_abandoned` | Panier abandonné |
| `order_created` | Commande créée |
| `order_shipped` | Commande expédiée |
| `order_delivered` | Commande livrée |
| `payment_failed` | Paiement échoué |
| `appointment_reminder` | Rappel de rendez-vous |
| `welcome` | Message de bienvenue |
| `custom` | Message libre (champ `message` requis) |

**Body — exemple abandon de panier :**
```json
{
  "agent_id": "uuid-agent",
  "event": "cart_abandoned",
  "idempotency_key": "shopify_cart_abc123_relance_1",
  "customer": {
    "name": "Awa",
    "phone": "+22507000000"
  },
  "cart": {
    "id": "cart_abc123",
    "items": [
      {
        "product_id": "prod_001",
        "name": "Robe de soirée noire",
        "variant": "Taille M",
        "quantity": 1,
        "price": 18000,
        "currency": "XOF",
        "image_url": "https://monshop.com/robe-noire.jpg"
      }
    ],
    "total": 18000,
    "currency": "XOF",
    "checkout_url": "https://monshop.com/checkout/abc123"
  }
}
```

**Body — exemple commande expédiée :**
```json
{
  "agent_id": "uuid-agent",
  "event": "order_shipped",
  "idempotency_key": "order-1234-shipped",
  "customer": { "name": "Kouamé", "phone": "+22501000000" },
  "order": {
    "id": "order_1234",
    "reference": "#1234",
    "tracking_number": "CI-XYZ-789",
    "carrier": "Chronopost CI",
    "estimated_delivery": "2026-04-06"
  }
}
```

**Body — event custom :**
```json
{
  "agent_id": "uuid-agent",
  "event": "custom",
  "customer": { "name": "Marie", "phone": "+22505000000" },
  "message": "Votre rendez-vous de demain a été confirmé.",
  "data": { "appointment_id": "appt_123" }
}
```

**Réponse (200) :**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "conversation_id": "conv_uuid",
    "event": "cart_abandoned",
    "status": "sent",
    "sent_at": "2026-04-04T10:00:00Z"
  }
}
```

---

### GET /api/public/v1/status

**Rôle :** vérifier si un agent est connecté et prêt à envoyer des messages.

**Query params :**

| Paramètre | Obligatoire | Description |
|---|---|---|
| `agent_id` | Oui | UUID de l'agent |

**Exemple :**
```bash
GET /api/public/v1/status?agent_id=uuid-agent
Authorization: Bearer sk_live_xxxx
```

**Réponse (200) :**
```json
{
  "success": true,
  "data": {
    "agent_id": "uuid-agent",
    "name": "Mon Agent Boutique",
    "is_active": true,
    "whatsapp_connected": true,
    "whatsapp_phone": "+22507000000",
    "status": "ready"
  }
}
```

**Valeurs de `status` :**

| status | Signification |
|---|---|
| `ready` | Agent actif et connecté → envoi possible |
| `disconnected` | Agent actif mais WhatsApp déconnecté |
| `paused` | Agent mis en pause manuellement |

---

## TIER 2 — DATA SYNC API

### POST /api/public/v1/sync

**Rôle :** synchroniser les données métier vers WazzapAI. L'agent les utilise pour répondre aux questions sans interroger le système externe.

**Body :**
```json
{
  "agent_id": "uuid-agent",
  "data_type": "product",
  "items": [
    {
      "id": "prod_001",
      "data": {
        "name": "Robe de soirée noire",
        "variants": [
          { "size": "M", "price": 18000, "stock": 5 },
          { "size": "L", "price": 18000, "stock": 0 }
        ],
        "colors": ["Noir", "Rouge"],
        "in_stock": true
      }
    }
  ]
}
```

| Champ | Description |
|---|---|
| `data_type` | `product`, `customer`, `catalog`, `faq`, `custom` |
| `items[].id` | Identifiant externe — utilisé pour l'upsert |
| `items[].data` | Données libres en JSON |

**Comportement :** si `items[].id` existe déjà → mise à jour. Sinon → insertion.

**Réponse (200) :**
```json
{
  "success": true,
  "data": {
    "synced": 2,
    "data_type": "product",
    "agent_id": "uuid-agent"
  }
}
```

### DELETE /api/public/v1/sync

**Rôle :** supprimer des données synchronisées.

**Body :**
```json
{
  "agent_id": "uuid-agent",
  "data_type": "product",
  "ids": ["prod_001", "prod_002"]
}
```

---

## TIER 3 — LECTURE

### GET /api/public/v1/conversations

**Rôle :** lister les conversations d'un agent.

**Query params :**

| Paramètre | Obligatoire | Description |
|---|---|---|
| `agent_id` | Oui | UUID de l'agent |
| `phone` | Non | Filtrer par numéro client |
| `status` | Non | `active` ou `closed` |
| `limit` | Non | Défaut 20, max 100 |
| `offset` | Non | Pagination |

**Réponse (200) :**
```json
{
  "success": true,
  "data": [
    {
      "id": "conv_uuid",
      "customer_phone": "+22507000000",
      "status": "active",
      "created_at": "2026-04-04T10:00:00Z",
      "updated_at": "2026-04-04T11:00:00Z",
      "metadata": { "external_context": { "event": "cart_abandoned" } }
    }
  ],
  "pagination": {
    "total": 42,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

---

### GET /api/public/v1/conversation

**Rôle :** récupérer le détail d'une conversation avec ses messages.

**Query params :**

| Paramètre | Obligatoire | Description |
|---|---|---|
| `conversation_id` | Oui | UUID de la conversation |
| `messages` | Non | `true` (défaut) ou `false` |
| `msg_limit` | Non | Défaut 50, max 200 |

**Réponse (200) :**
```json
{
  "success": true,
  "data": {
    "id": "conv_uuid",
    "agent_id": "uuid-agent",
    "customer_phone": "+22507000000",
    "status": "active",
    "created_at": "2026-04-04T10:00:00Z",
    "updated_at": "2026-04-04T11:00:00Z",
    "metadata": { "external_context": { "event": "cart_abandoned", "cart": {} } },
    "messages": [
      {
        "id": "msg_uuid",
        "role": "assistant",
        "content": "Bonjour Awa ! Votre panier vous attend...",
        "created_at": "2026-04-04T10:00:00Z",
        "status": "sent"
      },
      {
        "id": "msg_uuid2",
        "role": "user",
        "content": "Vous avez en rouge ?",
        "created_at": "2026-04-04T10:05:00Z",
        "status": "received"
      }
    ],
    "message_count": 2
  }
}
```

---

## CODES D'ERREUR

| Code HTTP | code | Cause | Solution |
|---|---|---|---|
| 401 | `UNAUTHORIZED` | Clé invalide, expirée ou mal formatée | Vérifier la clé dans le dashboard |
| 403 | `UNAUTHORIZED_AGENT` | Agent non autorisé pour cette clé | Vérifier les agents autorisés |
| 403 | `API_ACCESS_DISABLED` | Accès API non activé pour ce compte | Contacter l'administrateur |
| 404 | `AGENT_NOT_FOUND` | Agent introuvable | Vérifier l'agent_id |
| 404 | `NOT_FOUND` | Ressource introuvable | Vérifier l'id passé |
| 400 | `AGENT_INACTIVE` | Agent mis en pause | Réactiver l'agent dans le dashboard |
| 400 | `AGENT_DISCONNECTED` | WhatsApp non connecté | Reconnecter l'agent dans le dashboard |
| 400 | `INVALID_PHONE` | Format numéro invalide | Utiliser le format international `+22507000000` |
| 409 | `IDEMPOTENCY_CONFLICT` | Clé idempotency déjà utilisée | Normal — retourner le résultat original |
| 422 | `BAD_REQUEST` | Champs manquants ou invalides | Vérifier le format JSON |
| 429 | `RATE_LIMIT` | Trop de requêtes | Attendre `X-RateLimit-Reset` |
| 500 | `SEND_FAILED` | Échec envoi WhatsApp | Réessayer, contacter le support si persistant |
| 500 | `SERVER_ERROR` | Erreur interne | Contacter le support |
| 503 | `API_DISABLED` | API globalement désactivée | Contacter l'administrateur |

---

## WEBHOOKS SORTANTS

WazzapAI peut notifier votre système lorsqu'un événement se produit.

### Gestion via API

```bash
# Créer un webhook
POST /api/developer/webhooks
Authorization: Bearer sk_live_xxxx
{
  "url": "https://votre-systeme.com/webhook",
  "events": ["message.received", "lead.collected"],
  "description": "Webhook production"
}

# Réponse — secret affiché une seule fois
{
  "data": {
    "id": "wh_uuid",
    "url": "https://votre-systeme.com/webhook",
    "events": ["message.received", "lead.collected"],
    "secret": "whsec_abc123...",
    "is_active": true
  },
  "notice": "Copiez le secret maintenant — il ne sera plus affiché."
}

# Lister les webhooks
GET /api/developer/webhooks

# Désactiver un webhook
PATCH /api/developer/webhooks/[id]
{ "is_active": false }

# Supprimer un webhook
DELETE /api/developer/webhooks/[id]
```

**Limite :** 10 webhooks maximum par compte.

### Événements disponibles

| event | Déclencheur |
|---|---|
| `message.received` | Un client envoie un message à l'agent |
| `message.sent` | L'agent envoie un message |
| `conversation.started` | Nouvelle conversation |
| `conversation.ended` | Conversation terminée |
| `lead.collected` | Un lead a été collecté |

### Payload reçu sur votre URL

```json
POST https://votre-systeme.com/webhook
X-Wazzap-Signature: sha256=abc123...

{
  "event": "message.received",
  "timestamp": "2026-04-04T10:00:00Z",
  "data": {
    "conversation_id": "conv_uuid",
    "agent_id": "uuid-agent",
    "customer_phone": "+22507000000",
    "message": "Vous avez en rouge ?",
    "direction": "inbound"
  }
}
```

### Vérification de la signature

```javascript
const crypto = require('crypto')
const signature = req.headers['x-wazzap-signature']
const expected = 'sha256=' + crypto
  .createHmac('sha256', 'VOTRE_WEBHOOK_SECRET')
  .update(JSON.stringify(req.body))
  .digest('hex')
if (signature !== expected) return res.status(401).end()
```

---

## LIMITES ET QUOTAS

| Ressource | Limite |
|---|---|
| Messages par numéro / 24h | 5 |
| Requêtes par minute (par clé) | 60 (configurable jusqu'à 1000) |
| Requêtes par minute (par compte) | 200 |
| Clés API par compte | 10 |
| Webhooks par compte | 10 |
| Taille maximale du body | 1 MB |
| Timeout Live Query | 3 secondes |
| Rétention logs | 30 jours |
| TTL idempotency | 24 heures |

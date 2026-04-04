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

La clé est générée depuis le dashboard → Développeurs → Nouvelle clé.
Elle n'est affichée qu'une seule fois à la création. En cas de perte, il faut en créer une nouvelle.

---

## TIER 1 — TRIGGER API

### POST /api/public/v1/send

**Rôle** : envoyer un message WhatsApp simple depuis un agent.

**Cas d'usage** : notification ponctuelle, test rapide, message one-shot.

**Requête :**
```json
POST /api/public/v1/send
Authorization: Bearer sk_live_xxxx
Content-Type: application/json

{
  "agent_id": "uuid-de-votre-agent",
  "to": "+22507000000",
  "message": "Bonjour Awa, votre commande #1234 est expédiée.",
  "idempotency_key": "commande-1234-notif-expedition"
}
```

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

**Notes importantes :**
- `idempotency_key` : optionnel mais recommandé. Si la même clé est envoyée deux fois dans les 24h, WazzapAI retourne le résultat du premier appel sans renvoyer le message.
- `to` : format international avec indicatif pays (`+225`, `+33`, `+1`, etc.)
- L'agent doit être connecté à WhatsApp pour que l'envoi fonctionne.

---

### POST /api/public/v1/trigger

**Rôle** : déclencher une action métier typée. WazzapAI génère le message automatiquement depuis un template et stocke le contexte pour toute la durée de la conversation.

**Cas d'usage** : abandon de panier, confirmation de commande, rappel de rendez-vous.

**Événements supportés :**

| event | Description |
|---|---|
| `cart_abandoned` | Panier abandonné |
| `order_created` | Commande créée |
| `order_shipped` | Commande expédiée |
| `order_delivered` | Commande livrée |
| `payment_failed` | Paiement échoué |
| `appointment_reminder` | Rappel de rendez-vous |
| `custom` | Événement personnalisé |

**Exemple — abandon de panier Shopify :**
```json
POST /api/public/v1/trigger
Authorization: Bearer sk_live_xxxx
Content-Type: application/json

{
  "agent_id": "uuid-de-votre-agent",
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
        "image_url": "https://monshop.com/images/robe-noire.jpg"
      }
    ],
    "total": 18000,
    "currency": "XOF",
    "checkout_url": "https://monshop.com/checkout/abc123"
  }
}
```

**Message WhatsApp généré automatiquement :**
> Bonjour Awa ! Vous avez laissé des articles dans votre panier 🛍️
> Robe de soirée noire (Taille M) — 18 000 XOF
> Votre panier vous attend ici : https://monshop.com/checkout/abc123

**Exemple — commande expédiée :**
```json
{
  "agent_id": "uuid-agent",
  "event": "order_shipped",
  "idempotency_key": "order-1234-shipped-notif",
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

**Réponse :**
```json
{
  "success": true,
  "data": {
    "message_id": "msg_uuid",
    "conversation_id": "conv_uuid",
    "event": "order_shipped",
    "status": "sent",
    "sent_at": "2026-04-04T10:00:00Z"
  }
}
```

**Pourquoi utiliser /trigger plutôt que /send ?**
- Le message est généré automatiquement (pas besoin de le construire)
- Le contexte (panier, commande) est stocké dans la conversation
- L'agent peut y répondre intelligemment : "Vous avez en rouge ?" → l'agent connaît déjà les variantes

---

## TIER 2 — DATA SYNC API

### POST /api/public/v1/sync

**Rôle** : synchroniser les données métier de votre plateforme vers WazzapAI. L'agent les utilise pour répondre aux questions clients sans avoir à appeler votre système externe à chaque fois.

**Types de données supportés :**

| data_type | Description |
|---|---|
| `product` | Fiche produit (nom, variantes, prix, stock) |
| `customer` | Profil client |
| `catalog` | Catalogue complet |
| `faq` | Questions/réponses fréquentes |
| `custom` | Données métier libres |

**Exemple — synchroniser un catalogue produits :**
```json
POST /api/public/v1/sync
Authorization: Bearer sk_live_xxxx
Content-Type: application/json

{
  "agent_id": "uuid-agent",
  "data_type": "product",
  "items": [
    {
      "external_id": "prod_001",
      "data": {
        "name": "Robe de soirée noire",
        "description": "Robe élégante pour soirées et événements",
        "category": "Robes",
        "variants": [
          { "size": "S", "price": 18000, "stock": 3, "currency": "XOF" },
          { "size": "M", "price": 18000, "stock": 5, "currency": "XOF" },
          { "size": "L", "price": 18000, "stock": 0, "currency": "XOF" }
        ],
        "colors": ["Noir", "Rouge", "Bleu marine"],
        "images": ["https://monshop.com/robe-noire.jpg"],
        "in_stock": true
      }
    },
    {
      "external_id": "prod_002",
      "data": {
        "name": "Sac à main cuir",
        "price": 35000,
        "currency": "XOF",
        "in_stock": true
      }
    }
  ]
}
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "upserted": 2,
    "data_type": "product",
    "agent_id": "uuid-agent"
  }
}
```

**Comportement :**
- Si `external_id` existe déjà → mise à jour (upsert)
- Si `external_id` est nouveau → insertion
- L'opération est idempotente par design

**Après synchronisation, l'agent peut répondre à :**
- "Vous avez la robe noire en taille L ?" → "La taille L est actuellement en rupture de stock. Nous avons S et M disponibles."
- "Quel est le prix du sac ?" → "Le sac à main cuir est à 35 000 XOF."
- "C'est quoi les couleurs disponibles ?" → "Noir, Rouge et Bleu marine."

**Exemple — synchroniser une FAQ :**
```json
{
  "agent_id": "uuid-agent",
  "data_type": "faq",
  "items": [
    {
      "external_id": "faq_livraison",
      "data": {
        "question": "Quels sont les délais de livraison ?",
        "answer": "Abidjan : 24-48h. Intérieur : 3-5 jours ouvrables. Livraison gratuite dès 20 000 XOF."
      }
    },
    {
      "external_id": "faq_retour",
      "data": {
        "question": "Comment retourner un article ?",
        "answer": "Retour sous 7 jours, article non porté. Remboursement sous 5 jours ouvrables."
      }
    }
  ]
}
```

---

## TIER 3 — LIVE QUERY API

### Configuration (dashboard agent)

La Live Query permet à l'agent d'appeler votre système en temps réel pendant une conversation.

Dans les paramètres de l'agent :
- **Live Query URL** : votre endpoint qui recevra les requêtes
- **Live Query Secret** : secret pour vérifier la signature HMAC-SHA256

### Comment ça fonctionne

1. Un client envoie un message à l'agent
2. Avant de générer la réponse IA, WazzapAI envoie une requête à votre URL
3. Votre système retourne des données en temps réel
4. L'agent les intègre dans sa réponse

**Requête envoyée par WazzapAI à votre URL :**
```json
POST https://votre-systeme.com/wazzap-query
X-Wazzap-Signature: sha256=abc123...
Content-Type: application/json

{
  "customer_phone": "+22507000000",
  "message": "Où est ma commande ?",
  "conversation_id": "conv_uuid",
  "agent_id": "uuid-agent",
  "timestamp": "2026-04-04T10:00:00Z"
}
```

**Votre système répond (dans les 3 secondes) :**
```json
{
  "answer": "Votre commande #1234 est en cours de livraison. Livraison prévue aujourd'hui avant 18h."
}
```

**OU en format structuré :**
```json
{
  "data": {
    "order_id": "1234",
    "status": "en_livraison",
    "eta": "2026-04-04T18:00:00Z",
    "carrier": "Chronopost CI",
    "tracking_url": "https://track.chronopost.ci/xyz"
  }
}
```

**Vérification de la signature :**
```javascript
// Node.js
const crypto = require('crypto')
const signature = req.headers['x-wazzap-signature']
const expected = 'sha256=' + crypto
  .createHmac('sha256', 'VOTRE_LIVE_QUERY_SECRET')
  .update(JSON.stringify(req.body))
  .digest('hex')
if (signature !== expected) return res.status(401).json({ error: 'Invalid signature' })
```

**Comportement en cas d'échec :**
- Timeout (>3s) → l'agent répond avec ses données connues
- Erreur HTTP → idem, fail silencieux
- La conversation continue normalement dans tous les cas

---

## CODES D'ERREUR

| Code | Raison | Solution |
|---|---|---|
| `401 UNAUTHORIZED` | Clé API invalide ou expirée | Vérifier la clé dans le dashboard |
| `403 FORBIDDEN` | Agent non autorisé pour cette clé | Vérifier les agents autorisés |
| `404 NOT_FOUND` | Agent introuvable | Vérifier l'agent_id |
| `409 IDEMPOTENCY_CONFLICT` | Clé idempotency déjà utilisée | Normal — retourner le résultat original |
| `422 VALIDATION_ERROR` | Champs manquants ou invalides | Vérifier le format JSON |
| `429 RATE_LIMIT` | Trop de requêtes | Attendre `X-RateLimit-Reset` |
| `503 WHATSAPP_DISCONNECTED` | Agent non connecté à WhatsApp | Reconnecter l'agent dans le dashboard |
| `500 SERVER_ERROR` | Erreur interne | Contacter le support |

---

## WEBHOOKS SORTANTS

WazzapAI peut notifier votre système lorsqu'un événement se produit.

### Configuration (dashboard développeurs)

URL de destination + secret HMAC.

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
X-Wazzap-Signature: sha256=...
Content-Type: application/json

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

---

## LIMITES ET QUOTAS

| Ressource | Limite |
|---|---|
| Messages par numéro / 24h | 5 |
| Requêtes par minute (par clé) | 60 (configurable) |
| Requêtes par minute (par compte) | 200 |
| Taille maximale du body | 1 MB |
| Timeout Live Query | 3 secondes |
| Rétention logs | 30 jours |

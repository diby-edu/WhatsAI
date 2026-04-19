# API Publique WazzapAI - Exemples d'integration n8n et WooCommerce (2026-04-19)

## 1. Principe simple

Dans la plupart des cas, la plateforme externe ne parle pas directement a WhatsApp.

Elle parle a WazzapAI via :

- `POST /api/public/v1/send`
- `POST /api/public/v1/trigger`
- `POST /api/public/v1/sync`
- `GET /api/public/v1/status`
- `GET /api/public/v1/conversations`
- `GET /api/public/v1/conversation`

## 2. n8n - cas recommande

### Cas A - relance panier abandonne

Workflow n8n :

1. Webhook entrant depuis la boutique
2. Noeud `Set` ou `Code` pour mapper les champs
3. Noeud `HTTP Request` vers WazzapAI `/trigger`

Payload exact recommande :

```json
{
  "agent_id": "UUID_AGENT",
  "event": "cart_abandoned",
  "customer": {
    "name": "Koffi",
    "phone": "+2250700000000",
    "email": "koffi@example.com"
  },
  "cart": {
    "id": "cart_123",
    "total": 12500,
    "currency": "FCFA",
    "items": [
      {
        "name": "Chaussure noire",
        "variant": "42",
        "qty": 1,
        "price": 12500
      }
    ]
  },
  "idempotency_key": "cart_123_relance_1",
  "metadata": {
    "source_platform": "n8n",
    "store": "boutique-demo"
  }
}
```

Configuration du noeud `HTTP Request` n8n :

- Method: `POST`
- URL: `https://wazzapai.com/api/public/v1/trigger`
- Authentication: none
- Header `Authorization`: `Bearer sk_live_xxx`
- Header `Content-Type`: `application/json`
- Body Content Type: `JSON`

### Cas B - message exact

Quand le texte est deja determine dans n8n :

```json
{
  "agent_id": "UUID_AGENT",
  "to": "+2250700000000",
  "message": "Bonjour, votre commande CMD-4587 est prete pour retrait.",
  "idempotency_key": "cmd_4587_ready_v1",
  "metadata": {
    "source_platform": "n8n"
  }
}
```

Endpoint :

- `POST https://wazzapai.com/api/public/v1/send`

### Cas C - synchroniser le catalogue

Workflow n8n :

1. Cron quotidien
2. Lecture produits depuis ERP, Shopify, WooCommerce ou Google Sheet
3. `HTTP Request` vers `/sync`

Payload exact :

```json
{
  "agent_id": "UUID_AGENT",
  "type": "product",
  "items": [
    {
      "id": "sku_001",
      "name": "Robe noire",
      "description": "Robe de soiree elegante",
      "price": 18000,
      "stock": 5
    },
    {
      "id": "sku_002",
      "name": "Sac cuir",
      "description": "Sac cuir noir",
      "price": 25000,
      "stock": 2
    }
  ]
}
```

## 3. WooCommerce - faut-il un plugin ?

Reponse courte :

- non, pas obligatoirement
- oui, un plugin peut devenir utile plus tard

### Sans plugin WooCommerce

C'est la voie la plus simple pour commencer.

Schema recommande :

1. WooCommerce emet un webhook natif
2. le webhook part vers n8n ou un petit middleware Node
3. n8n transforme la charge utile WooCommerce
4. n8n appelle WazzapAI `/trigger` ou `/send`

Avantages :

- zero developpement plugin WordPress au depart
- plus rapide a mettre en production
- plus facile a corriger et observer
- mapping metier plus souple

### Avec plugin WooCommerce

Un plugin devient pertinent si vous voulez :

- une installation "one click" chez plusieurs marchands
- une page de configuration native dans WordPress
- un mapping produit/client depuis l'admin WooCommerce
- des retries locaux controles cote boutique
- des logs visibles dans WordPress

Donc :

- pour valider le produit, pas besoin de plugin
- pour industrialiser proprement un connecteur WooCommerce, un plugin peut etre une phase 2 tres logique

## 4. Exemple WooCommerce via webhook natif + n8n

### Webhook WooCommerce

Evenement WordPress/WooCommerce :

- `order.created`
- ou `order.updated`

Destination :

- webhook n8n du type `https://n8n.example.com/webhook/wazzap-order-created`

### Mapping n8n vers WazzapAI

Exemple payload final vers `/trigger` :

```json
{
  "agent_id": "UUID_AGENT",
  "event": "order_created",
  "customer": {
    "name": "{{$json.billing.first_name}} {{$json.billing.last_name}}",
    "phone": "{{$json.billing.phone}}",
    "email": "{{$json.billing.email}}"
  },
  "order": {
    "id": "{{$json.id}}",
    "reference": "{{$json.number}}",
    "total": "{{$json.total}}",
    "status": "{{$json.status}}"
  },
  "data": {
    "payment_method": "{{$json.payment_method_title}}"
  },
  "idempotency_key": "woo_order_created_{{$json.id}}"
}
```

### Pour les paniers abandonnes WooCommerce

WooCommerce ne donne pas toujours cela nativement.

Options :

- plugin tiers WooCommerce de cart recovery qui pousse un webhook
- logique custom WordPress
- ou middleware qui reconstruit les paniers inactifs

Dans ce cas, WazzapAI reste identique :

- la plateforme prepare l'evenement
- elle appelle ensuite `POST /api/public/v1/trigger`

## 5. Exemple lecture depuis une plateforme externe

### Verifier si l'agent est pret

```bash
curl "https://wazzapai.com/api/public/v1/status?agent_id=UUID_AGENT" \
  -H "Authorization: Bearer sk_live_xxx"
```

### Lister les conversations

```bash
curl "https://wazzapai.com/api/public/v1/conversations?agent_id=UUID_AGENT&limit=20" \
  -H "Authorization: Bearer sk_live_xxx"
```

### Relire une conversation

```bash
curl "https://wazzapai.com/api/public/v1/conversation?conversation_id=UUID_CONVERSATION" \
  -H "Authorization: Bearer sk_live_xxx"
```

## 6. Exemple Live Query pour WooCommerce

Le Live Query n'est pas appele par WooCommerce vers WazzapAI.

C'est l'inverse :

- l'utilisateur ecrit a l'agent sur WhatsApp
- WazzapAI appelle votre endpoint externe
- votre endpoint repond avec la donnee temps reel

Exemple endpoint externe :

- `POST https://middleware.example.com/wazzap/live-query`

Payload recu :

```json
{
  "customer_phone": "+2250700000000",
  "message": "Ou en est ma commande CMD-4587 ?",
  "conversation_id": "UUID_CONVERSATION",
  "agent_id": "UUID_AGENT"
}
```

Reponse :

```json
{
  "answer": "La commande CMD-4587 est en expedition. Livraison prevue demain."
}
```

## 7. Recommandation finale

Pour demarrer proprement :

1. valider l'API publique avec n8n
2. brancher WooCommerce via webhook natif vers n8n
3. ajouter `sync` pour catalogue/FAQ
4. ajouter `live_query_url` seulement pour les cas temps reel utiles
5. construire un plugin WooCommerce seulement si le besoin produit se repete chez plusieurs marchands

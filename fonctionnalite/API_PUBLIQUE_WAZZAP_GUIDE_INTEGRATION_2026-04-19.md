# API Publique WazzapAI - Guide d'integration (etat reel au 2026-04-19)

## 1. Portee

L'API publique WazzapAI est generique a l'application. Elle n'est pas limitee a un agent particulier.

Chaque appel reste cible par `agent_id`, puis filtre par :

- la cle API (`Authorization: Bearer sk_live_...`)
- le proprietaire de la cle
- la liste optionnelle `allowed_agent_ids`
- l'etat de l'agent (`is_active`, `whatsapp_connected`)

En pratique : la meme implementation sert tous les agents de l'application, mais chaque integration externe doit preciser quel agent elle pilote.

## 2. Endpoints actuellement presents

### Trigger / Outbound

- `POST /api/public/v1/send`
- `POST /api/public/v1/trigger`

### Data Sync

- `POST /api/public/v1/sync`
- `DELETE /api/public/v1/sync`

### Read API

- `GET /api/public/v1/status`
- `GET /api/public/v1/conversations`
- `GET /api/public/v1/conversation`

## 3. Authentification

Format :

```http
Authorization: Bearer sk_live_xxxxxxxxx
```

La cle brute n'est pas stockee en clair. Le serveur compare son hash SHA256 a `api_keys.key_hash`.

## 4. Semantique des endpoints

### `POST /api/public/v1/send`

Usage :

- envoyer un texte exact depuis une plateforme externe

Exemple :

```bash
curl -X POST https://wazzapai.com/api/public/v1/send \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "to": "+2250700000000",
    "message": "Bonjour, votre commande est prete.",
    "idempotency_key": "order_123_ready_v1"
  }'
```

Reponse typique :

```json
{
  "success": true,
  "data": {
    "message_id": null,
    "conversation_id": "UUID_CONVERSATION",
    "status": "queued",
    "queued": true,
    "queued_at": "2026-04-19T01:01:26.721Z"
  }
}
```

### `POST /api/public/v1/trigger`

Usage :

- envoyer un evenement metier structure pour generer un message sortant

Evenements template actuellement visibles dans le code :

- `cart_abandoned`
- `order_created`
- `order_shipped`
- `payment_failed`
- `appointment_reminder`
- `welcome`
- `custom`

Exemple :

```bash
curl -X POST https://wazzapai.com/api/public/v1/trigger \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "event": "cart_abandoned",
    "customer": {
      "name": "Koffi",
      "phone": "+2250700000000"
    },
    "cart": {
      "id": "cart_123",
      "total": 12500,
      "currency": "FCFA",
      "items": [
        { "name": "Chaussure noire", "qty": 1, "price": 12500 }
      ]
    },
    "idempotency_key": "cart_123_relance_1"
  }'
```

### `POST /api/public/v1/sync`

Usage :

- injecter des donnees externes dans `agent_external_data`
- ces donnees sont ensuite ajoutees au contexte de reponse dans le generateur IA

Types acceptes :

- `product`
- `customer`
- `catalog`
- `faq`
- `custom`

Exemple :

```bash
curl -X POST https://wazzapai.com/api/public/v1/sync \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "type": "product",
    "items": [
      {
        "id": "sku_001",
        "name": "Robe noire",
        "description": "Robe de soiree elegante",
        "price": 18000,
        "stock": 5
      }
    ]
  }'
```

### `DELETE /api/public/v1/sync`

Usage :

- supprimer les donnees synchronisees d'un agent

Exemple :

```bash
curl -X DELETE https://wazzapai.com/api/public/v1/sync \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "type": "product"
  }'
```

### `GET /api/public/v1/status`

Usage :

- savoir si l'agent est pret a envoyer sur WhatsApp

Exemple :

```bash
curl "https://wazzapai.com/api/public/v1/status?agent_id=UUID_AGENT" \
  -H "Authorization: Bearer sk_live_xxx"
```

Statuts metier renvoyes :

- `ready`
- `paused`
- `disconnected`

### `GET /api/public/v1/conversations`

Usage :

- lister les conversations d'un agent

Filtres :

- `agent_id` requis
- `phone` optionnel
- `status` optionnel
- `limit` et `offset`

Exemple :

```bash
curl "https://wazzapai.com/api/public/v1/conversations?agent_id=UUID_AGENT&limit=20" \
  -H "Authorization: Bearer sk_live_xxx"
```

### `GET /api/public/v1/conversation`

Usage :

- relire le detail d'une conversation et ses messages

Exemple :

```bash
curl "https://wazzapai.com/api/public/v1/conversation?conversation_id=UUID_CONVERSATION" \
  -H "Authorization: Bearer sk_live_xxx"
```

## 5. Live Query API - ce que c'est vraiment

Le Live Query n'est pas un endpoint public supplementaire expose a la plateforme.

C'est une capacite agent-side :

- si `agents.live_query_url` est configure
- alors, lors d'un vrai message entrant utilisateur
- WazzapAI appelle ce systeme externe en `POST`
- timeout strict : 3 secondes
- signature HMAC optionnelle si `live_query_secret` est defini
- si l'appel reussit, la reponse est injectee dans le contexte IA
- si l'appel echoue, l'agent repond quand meme sans ces donnees

En clair :

- `send` / `trigger` / `sync` / `status` / `conversation(s)` = API publique entrante
- `live_query_url` = callback sortant de WazzapAI vers un systeme externe

### Ou se configure le Live Query aujourd'hui

Le support backend est bien implemente :

- colonnes DB `agents.live_query_url` et `agents.live_query_secret`
- lecture runtime dans le generateur IA
- champs acceptes par `PATCH /api/agents/[id]`

Important :

- dans le dashboard agent, les champs existent visuellement
- mais la section est actuellement desactivee cote UI
- donc, en l'etat actuel, la configuration se fait soit par mise a jour backend authentifiee, soit directement en base

En pratique, cela veut dire :

- oui, la fonctionnalite existe techniquement
- non, elle n'est pas encore "self-service" proprement accessible a tous les utilisateurs depuis l'UI

Payload callback envoye par WazzapAI vers `live_query_url` :

```json
{
  "customer_phone": "+2250700000000",
  "message": "Ou en est ma commande 4587 ?",
  "conversation_id": "UUID_CONVERSATION",
  "agent_id": "UUID_AGENT"
}
```

Reponse minimale attendue du systeme externe :

```json
{
  "answer": "La commande 4587 est en preparation et part aujourd'hui."
}
```

## 6. Rate limiting actuel

Dans le code actuel :

- par cle API : configurable, typiquement `60 req/min`
- par compte : `200 req/min`
- par numero cible : `5 messages / 24h`

Important :

- la limite `5 / 24h / numero` est appliquee aujourd'hui dans `send` et `trigger`
- elle est geree en memoire
- elle n'est pas partagee entre plusieurs instances
- elle se reinitialise si le process redemarre

Conclusion :

- utile comme garde-fou de demarrage
- trop stricte pour un usage transactionnel mature
- pas ideale comme politique finale de production

## 7. Etat reel de maturite

### Valide en production

- `POST /api/public/v1/send`
- livraison WhatsApp reelle via la queue outbound
- correction anti-doublon deployee

### Implemente dans le code mais pas encore valide en prod bout-en-bout

- `POST /api/public/v1/trigger`
- `POST /api/public/v1/sync`
- `DELETE /api/public/v1/sync`
- `GET /api/public/v1/status`
- `GET /api/public/v1/conversations`
- `GET /api/public/v1/conversation`
- `live_query_url`

## 8. Recommandations avant ouverture commerciale large

- tester `trigger` en reel avec 2 ou 3 evenements representatifs
- tester `sync` avec un vrai lot produits / FAQ
- tester `status`, `conversations`, `conversation` avec une cle externe
- remplacer a terme le rate limit "5 messages / 24h / numero" par une politique plus souple et configurable
- idealement sortir ce rate limit memoire vers Redis ou base si le produit scale

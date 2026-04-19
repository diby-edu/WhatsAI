# API Publique WazzapAI - Protocole de tests production (2026-04-19)

## 1. Objectif

Valider endpoint par endpoint, en production, avec un vrai agent WhatsApp connecte, sans supposer que "si `/send` marche, tout le reste marche aussi".

Ce protocole se concentre sur :

- `POST /api/public/v1/send`
- `POST /api/public/v1/trigger`
- `POST /api/public/v1/sync`
- `DELETE /api/public/v1/sync`
- `GET /api/public/v1/status`
- `GET /api/public/v1/conversations`
- `GET /api/public/v1/conversation`
- le comportement `live_query_url`

## 2. Prerequis

- une cle API publique active `sk_live_...`
- un `agent_id` autorise par cette cle
- l'agent doit etre `is_active = true`
- l'agent doit etre `whatsapp_connected = true`
- un numero WhatsApp de test reel
- si possible, un second numero pour eviter de heurter la limite anti-spam par numero

## 3. Verification zero

Tester d'abord le statut de l'agent :

```bash
curl "https://wazzapai.com/api/public/v1/status?agent_id=UUID_AGENT" \
  -H "Authorization: Bearer sk_live_xxx"
```

Attendu :

- HTTP `200`
- `success: true`
- `data.status = "ready"`

Si `paused` ou `disconnected`, on stoppe la suite.

## 4. Test 1 - Send

Commande :

```bash
curl -X POST https://wazzapai.com/api/public/v1/send \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "to": "+2250700000000",
    "message": "Test send prod 2026-04-19",
    "idempotency_key": "send_test_2026_04_19_v1"
  }'
```

Attendu immediat :

- HTTP `200`
- `status = "queued"`
- `conversation_id` non nul

Attendu metier :

- un message WhatsApp recu une seule fois
- une ligne `outbound_messages.status = sent`
- une conversation visible via `GET /conversations`

## 5. Test 2 - Trigger

Commande :

```bash
curl -X POST https://wazzapai.com/api/public/v1/trigger \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "event": "order_created",
    "customer": {
      "name": "Koffi",
      "phone": "+2250700000000"
    },
    "order": {
      "id": "4587",
      "reference": "CMD-4587",
      "total": 12500
    },
    "idempotency_key": "order_created_4587_v1"
  }'
```

Attendu immediat :

- HTTP `200`
- `event = "order_created"`
- `message_sent` non vide
- `status = "queued"`

Attendu metier :

- un message WhatsApp recu une seule fois
- contenu coherent avec le template `order_created`

## 6. Test 3 - Sync

Commande :

```bash
curl -X POST https://wazzapai.com/api/public/v1/sync \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "type": "product",
    "items": [
      {
        "id": "sku_robe_noire",
        "name": "Robe noire",
        "description": "Robe de soiree elegante",
        "price": 18000,
        "stock": 5
      }
    ]
  }'
```

Attendu :

- HTTP `200`
- `success = true`
- `data.synced = 1`

Validation fonctionnelle recommande :

- envoyer ensuite un vrai message entrant a l'agent du style :
  - `Avez-vous la robe noire en stock ?`
- verifier que la reponse de l'agent exploite bien la donnee synchronisee

## 7. Test 4 - Sync delete

Commande :

```bash
curl -X DELETE https://wazzapai.com/api/public/v1/sync \
  -H "Authorization: Bearer sk_live_xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "UUID_AGENT",
    "type": "product"
  }'
```

Attendu :

- HTTP `200`
- `success = true`

Validation fonctionnelle :

- redemander a l'agent une information dependante de ce produit
- verifier que la reponse ne s'appuie plus sur cette source synchronisee

## 8. Test 5 - Conversations list

Commande :

```bash
curl "https://wazzapai.com/api/public/v1/conversations?agent_id=UUID_AGENT&limit=20" \
  -H "Authorization: Bearer sk_live_xxx"
```

Attendu :

- HTTP `200`
- `data` tableau
- presence de la conversation du numero teste

## 9. Test 6 - Conversation detail

Commande :

```bash
curl "https://wazzapai.com/api/public/v1/conversation?conversation_id=UUID_CONVERSATION" \
  -H "Authorization: Bearer sk_live_xxx"
```

Attendu :

- HTTP `200`
- `data.id = UUID_CONVERSATION`
- `data.messages` present si non desactive

## 10. Test 7 - Idempotence

Rejouer exactement le meme appel `/send` ou `/trigger` avec la meme `idempotency_key`.

Attendu :

- HTTP `200`
- header `X-Idempotent-Replayed: true`
- aucun second message WhatsApp envoye

## 11. Test 8 - Rate limiting

Tester prudemment :

- plusieurs appels rapides pour verifier le `429` cote cle API
- ne pas spammer un meme numero inutilement

Important :

- la limite actuelle par numero est `5 messages / 24h`
- elle est en memoire
- elle est utile comme garde-fou temporaire
- ce n'est pas encore une politique robuste de production multi-instance

## 12. Test 9 - Live Query

Preparation :

- renseigner `agents.live_query_url`
- optionnellement `agents.live_query_secret`
- le endpoint externe doit repondre vite, idealement en moins de 1 seconde

Payload envoye par WazzapAI :

```json
{
  "customer_phone": "+2250700000000",
  "message": "Ou en est ma commande 4587 ?",
  "conversation_id": "UUID_CONVERSATION",
  "agent_id": "UUID_AGENT"
}
```

Reponse attendue :

```json
{
  "answer": "La commande 4587 est en livraison aujourd'hui."
}
```

Validation :

- un vrai message entrant utilisateur doit provoquer l'appel externe
- la reponse de l'agent doit reutiliser cette information temps reel
- si le endpoint externe tombe, l'agent doit quand meme repondre

## 13. Ordre recommande de validation

Ordre recommande pour une mise en service propre :

1. `GET /status`
2. `POST /send`
3. `POST /trigger`
4. `GET /conversations`
5. `GET /conversation`
6. `POST /sync`
7. test conversationnel reel apres sync
8. `DELETE /sync`
9. `live_query_url`

## 14. Verdict attendu

On peut dire "API publique prod validee" seulement si :

- `/send` envoie bien un seul message reel
- `/trigger` envoie bien un seul message reel
- `/sync` influence reellement les reponses de l'agent
- `/status`, `/conversations`, `/conversation` renvoient des donnees conformes
- `live_query_url` fonctionne en succes et degrade proprement en echec

Sans cela, on a une implementation presente dans le code, mais pas encore entierement validee en prod.

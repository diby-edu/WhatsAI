# GUIDE D'INTÉGRATION — API WAZZAPAI

Ce guide explique pas à pas comment connecter une plateforme externe à WazzapAI.

---

## ÉTAPE 1 — Obtenir une clé API

1. Connexion au dashboard WazzapAI
2. Menu latéral → **Développeurs**
3. Cliquer sur **Nouvelle clé**
4. Donner un nom (ex : "Boutique Shopify")
5. Choisir l'environnement : `Live` (production) ou `Test`
6. **Copier la clé immédiatement** — elle ne sera plus jamais affichée

La clé ressemble à : `sk_live_abc123xyz456...`

---

## ÉTAPE 2 — Récupérer l'ID de l'agent

1. Dashboard → **Agents**
2. Cliquer sur votre agent
3. Copier l'UUID dans l'URL ou dans les paramètres de l'agent

Format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

---

## ÉTAPE 3 — Premier test avec curl

Tester que tout fonctionne avant d'intégrer dans une plateforme.

```bash
curl -X POST https://votre-domaine.com/api/public/v1/send \
  -H "Authorization: Bearer sk_live_VOTRE_CLE" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "VOTRE_AGENT_ID",
    "to": "+22507000000",
    "message": "Test API WazzapAI — tout fonctionne."
  }'
```

**Réponse attendue :**
```json
{ "success": true, "data": { "status": "sent", ... } }
```

Si vous obtenez `401` → la clé est incorrecte.
Si vous obtenez `503` → l'agent n'est pas connecté à WhatsApp.

---

## INTÉGRATION SHOPIFY

### Objectif : relancer automatiquement les paniers abandonnés

### Option A — Via Shopify Flow (sans code)

1. Dans Shopify Admin → **Flow**
2. Créer un workflow : déclencheur **Abandon de panier**
3. Ajouter une action **HTTP Request** :
   - URL : `https://votre-domaine.com/api/public/v1/trigger`
   - Méthode : POST
   - Headers : `Authorization: Bearer sk_live_xxxx` + `Content-Type: application/json`
   - Body :
```json
{
  "agent_id": "VOTRE_AGENT_ID",
  "event": "cart_abandoned",
  "idempotency_key": "{{checkout.id}}_relance_1",
  "customer": {
    "name": "{{checkout.billing_address.first_name}}",
    "phone": "{{checkout.billing_address.phone}}"
  },
  "cart": {
    "id": "{{checkout.id}}",
    "items": "{{checkout.line_items}}",
    "total": "{{checkout.total_price}}",
    "currency": "{{checkout.currency}}",
    "checkout_url": "{{checkout.abandoned_checkout_url}}"
  }
}
```

### Option B — Via webhook Shopify + script Node.js

```javascript
// server.js — recevoir les webhooks Shopify
const express = require('express')
const app = express()
app.use(express.json())

app.post('/shopify/checkout-abandoned', async (req, res) => {
  const checkout = req.body

  // Vérifier qu'un numéro de téléphone est disponible
  const phone = checkout.billing_address?.phone || checkout.phone
  if (!phone) return res.json({ skipped: true })

  const response = await fetch('https://votre-domaine.com/api/public/v1/trigger', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_VOTRE_CLE',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: 'VOTRE_AGENT_ID',
      event: 'cart_abandoned',
      idempotency_key: `shopify_${checkout.id}_relance_1`,
      customer: {
        name: checkout.billing_address?.first_name || 'Client',
        phone: phone
      },
      cart: {
        id: checkout.id,
        items: checkout.line_items.map(item => ({
          product_id: String(item.product_id),
          name: item.title,
          variant: item.variant_title,
          quantity: item.quantity,
          price: parseFloat(item.price),
          currency: checkout.currency
        })),
        total: parseFloat(checkout.total_price),
        currency: checkout.currency,
        checkout_url: checkout.abandoned_checkout_url
      }
    })
  })

  const result = await response.json()
  res.json(result)
})

app.listen(3000)
```

### Synchroniser le catalogue Shopify vers WazzapAI

```javascript
// sync-catalog.js — à exécuter quotidiennement (cron)
const Shopify = require('@shopify/shopify-api')

async function syncCatalog() {
  // 1. Récupérer les produits depuis Shopify
  const products = await shopify.rest.Product.all({ session })

  // 2. Transformer au format WazzapAI
  const items = products.data.map(product => ({
    external_id: String(product.id),
    data: {
      name: product.title,
      description: product.body_html?.replace(/<[^>]+>/g, '') || '',
      category: product.product_type,
      variants: product.variants.map(v => ({
        size: v.option1,
        color: v.option2,
        price: parseFloat(v.price),
        stock: v.inventory_quantity,
        currency: 'XOF'
      })),
      in_stock: product.variants.some(v => v.inventory_quantity > 0),
      images: product.images.map(i => i.src)
    }
  }))

  // 3. Envoyer à WazzapAI
  const response = await fetch('https://votre-domaine.com/api/public/v1/sync', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer sk_live_VOTRE_CLE',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      agent_id: 'VOTRE_AGENT_ID',
      data_type: 'product',
      items
    })
  })

  const result = await response.json()
  console.log(`Synchronisé : ${result.data.upserted} produits`)
}

syncCatalog()
```

---

## INTÉGRATION WOOCOMMERCE

### Plugin WordPress — relance abandon de panier

```php
<?php
// functions.php de votre thème

add_action('woocommerce_cart_updated', 'wazzap_track_cart');

function wazzap_track_cart() {
    // WooCommerce Abandoned Cart plugin envoie un webhook
    // Ce handler le reçoit et appelle WazzapAI
}

// Webhook handler
add_action('rest_api_init', function() {
    register_rest_route('wazzap/v1', '/cart-abandoned', [
        'methods' => 'POST',
        'callback' => 'wazzap_handle_abandoned_cart',
        'permission_callback' => '__return_true'
    ]);
});

function wazzap_handle_abandoned_cart($request) {
    $cart = $request->get_json_params();

    $payload = [
        'agent_id' => 'VOTRE_AGENT_ID',
        'event' => 'cart_abandoned',
        'idempotency_key' => 'woo_cart_' . $cart['cart_id'] . '_relance_1',
        'customer' => [
            'name' => $cart['billing']['first_name'],
            'phone' => $cart['billing']['phone']
        ],
        'cart' => [
            'id' => $cart['cart_id'],
            'items' => array_map(function($item) {
                return [
                    'product_id' => (string) $item['product_id'],
                    'name' => $item['name'],
                    'quantity' => $item['quantity'],
                    'price' => (float) $item['price'],
                    'currency' => get_woocommerce_currency()
                ];
            }, $cart['cart_contents']),
            'total' => (float) $cart['cart_total'],
            'currency' => get_woocommerce_currency()
        ]
    ];

    $response = wp_remote_post('https://votre-domaine.com/api/public/v1/trigger', [
        'headers' => [
            'Authorization' => 'Bearer sk_live_VOTRE_CLE',
            'Content-Type' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15
    ]);

    return rest_ensure_response(['success' => true]);
}
?>
```

---

## INTÉGRATION ZAPIER

### Scénario : commande créée → message WhatsApp de confirmation

1. **Trigger** : WooCommerce / Shopify → "New Order"
2. **Action** : Webhooks by Zapier → Custom Request
   - URL : `https://votre-domaine.com/api/public/v1/trigger`
   - Méthode : POST
   - Headers :
     ```
     Authorization: Bearer sk_live_VOTRE_CLE
     Content-Type: application/json
     ```
   - Body (JSON) :
     ```json
     {
       "agent_id": "VOTRE_AGENT_ID",
       "event": "order_created",
       "idempotency_key": "zapier_order_{{order_id}}",
       "customer": {
         "name": "{{billing_first_name}}",
         "phone": "{{billing_phone}}"
       },
       "order": {
         "id": "{{order_id}}",
         "reference": "#{{order_number}}",
         "total": {{total}},
         "currency": "{{currency}}"
       }
     }
     ```

---

## INTÉGRATION PYTHON

```python
# wazzap_client.py

import requests
import hashlib
import time

class WazzapClient:
    def __init__(self, api_key: str, base_url: str, agent_id: str):
        self.api_key = api_key
        self.base_url = base_url
        self.agent_id = agent_id
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }

    def send(self, phone: str, message: str, idempotency_key: str = None) -> dict:
        payload = {
            'agent_id': self.agent_id,
            'to': phone,
            'message': message
        }
        if idempotency_key:
            payload['idempotency_key'] = idempotency_key

        r = requests.post(f'{self.base_url}/api/public/v1/send',
                         json=payload, headers=self.headers)
        r.raise_for_status()
        return r.json()

    def trigger(self, event: str, customer: dict, data: dict,
                idempotency_key: str = None) -> dict:
        payload = {
            'agent_id': self.agent_id,
            'event': event,
            'customer': customer,
            **data
        }
        if idempotency_key:
            payload['idempotency_key'] = idempotency_key

        r = requests.post(f'{self.base_url}/api/public/v1/trigger',
                         json=payload, headers=self.headers)
        r.raise_for_status()
        return r.json()

    def sync_products(self, products: list) -> dict:
        items = [{'external_id': str(p['id']), 'data': p} for p in products]
        r = requests.post(f'{self.base_url}/api/public/v1/sync',
                         json={'agent_id': self.agent_id,
                               'data_type': 'product', 'items': items},
                         headers=self.headers)
        r.raise_for_status()
        return r.json()


# Utilisation
client = WazzapClient(
    api_key='sk_live_VOTRE_CLE',
    base_url='https://votre-domaine.com',
    agent_id='VOTRE_AGENT_ID'
)

# Envoyer une notification simple
client.send('+22507000000', 'Votre commande est prête à être retirée.')

# Déclencher une relance de panier abandonné
client.trigger(
    event='cart_abandoned',
    customer={'name': 'Fatou', 'phone': '+22501000000'},
    data={
        'cart': {
            'items': [{'name': 'Boubou en wax', 'price': 25000, 'currency': 'XOF'}],
            'total': 25000,
            'currency': 'XOF'
        }
    },
    idempotency_key='cart_xyz_relance_1'
)

# Synchroniser des produits
client.sync_products([
    {'id': 1, 'name': 'Robe noire', 'price': 18000, 'currency': 'XOF',
     'variants': [{'size': 'M', 'stock': 5}, {'size': 'L', 'stock': 0}]}
])
```

---

## INTÉGRATION NODE.JS / JAVASCRIPT

```javascript
// wazzap-client.js

class WazzapClient {
  constructor({ apiKey, baseUrl, agentId }) {
    this.agentId = agentId
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    }
    this.baseUrl = baseUrl
  }

  async _post(path, body) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ agent_id: this.agentId, ...body })
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return res.json()
  }

  send(to, message, idempotencyKey) {
    return this._post('/api/public/v1/send', {
      to,
      message,
      ...(idempotencyKey && { idempotency_key: idempotencyKey })
    })
  }

  trigger(event, customer, data, idempotencyKey) {
    return this._post('/api/public/v1/trigger', {
      event,
      customer,
      ...data,
      ...(idempotencyKey && { idempotency_key: idempotencyKey })
    })
  }

  syncProducts(products) {
    const items = products.map(p => ({ external_id: String(p.id), data: p }))
    return this._post('/api/public/v1/sync', { data_type: 'product', items })
  }
}

// Utilisation
const wazzap = new WazzapClient({
  apiKey: 'sk_live_VOTRE_CLE',
  baseUrl: 'https://votre-domaine.com',
  agentId: 'VOTRE_AGENT_ID'
})

// Relance panier abandonné
await wazzap.trigger(
  'cart_abandoned',
  { name: 'Awa', phone: '+22507000000' },
  {
    cart: {
      items: [{ name: 'Robe noire', price: 18000, currency: 'XOF' }],
      total: 18000,
      currency: 'XOF'
    }
  },
  'cart_abc123_relance_1'
)
```

---

## RECEVOIR DES WEBHOOKS WAZZAPAI

Quand un client répond à votre agent, WazzapAI peut notifier votre système.

### Configuration

Dashboard → Développeurs → Webhooks → Ajouter

- URL : `https://votre-systeme.com/webhook`
- Events : sélectionner les événements souhaités
- Secret : générer un secret pour vérifier les signatures

### Recevoir et vérifier (Node.js)

```javascript
const crypto = require('crypto')

app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-wazzap-signature']
  const secret = process.env.WAZZAP_WEBHOOK_SECRET

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)
    .digest('hex')

  if (signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(req.body)

  switch (event.event) {
    case 'message.received':
      console.log(`Message reçu de ${event.data.customer_phone}: ${event.data.message}`)
      // Mettre à jour votre CRM, log, etc.
      break

    case 'lead.collected':
      const lead = event.data.lead
      console.log(`Nouveau lead: ${lead.name} — ${lead.phone}`)
      // Ajouter dans votre CRM
      break
  }

  res.json({ received: true })
})
```

---

## DIAGNOSTIC ET DÉPANNAGE

### Vérifier le statut de connexion WhatsApp de l'agent

```bash
curl "https://votre-domaine.com/api/public/v1/status?agent_id=VOTRE_AGENT_ID" \
  -H "Authorization: Bearer sk_live_VOTRE_CLE"
```

Réponse :
```json
{
  "agent_id": "uuid",
  "name": "Mon Agent",
  "whatsapp_connected": true,
  "whatsapp_phone": "+22507000000"
}
```

### Codes d'erreur fréquents

| Erreur | Cause probable | Solution |
|---|---|---|
| `401` | Clé expirée ou copiée avec espaces | Régénérer la clé |
| `503 WHATSAPP_DISCONNECTED` | Agent déconnecté | Dashboard → Agents → Reconnecter |
| `429` | Trop d'appels | Implémenter un retry avec backoff exponentiel |
| `409 IDEMPOTENCY` | Clé déjà utilisée | Normal — récupérer le résultat du header `X-Idempotency-Status` |

### Retry avec backoff exponentiel (recommandé pour la prod)

```javascript
async function sendWithRetry(payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await wazzap.send(payload.to, payload.message)
    } catch (err) {
      if (err.message.includes('429')) {
        // Attendre 2^i secondes avant de réessayer
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000))
        continue
      }
      throw err // Autres erreurs → ne pas réessayer
    }
  }
  throw new Error('Max retries reached')
}
```

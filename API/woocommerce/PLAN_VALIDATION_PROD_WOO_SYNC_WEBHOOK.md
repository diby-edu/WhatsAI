# Plan de validation prod WooCommerce (Sync + Webhook)

Ce plan valide 2 choses:
- la **sync catalogue** (Woo -> `agent_external_data`)
- le **webhook entrant commande** (Woo -> WazzapAI -> WhatsApp)

---

## 0) Variables de travail

Dans le terminal (VPS ou local):

```bash
export AGENT_ID="TON_AGENT_UUID_EXTERNAL_SYNC"
export SYNC_CONN_ID="TON_UUID_CONNEXION_SYNC_CATALOGUE"
export PLATFORM_CONN_ID="TON_UUID_CONNEXION_PLATEFORME_WOO"
```

---

## 1) Valider la connexion Sync Catalogue

Dans WazzapAI Dashboard:
- Ouvrir `Developers` -> `Sync catalogue`
- Créer/ouvrir la connexion Woo (store_url, consumer_key, consumer_secret)
- Cliquer `Tester connexion`
- Cliquer `Sync maintenant`

SQL de contrôle:

```sql
select id, last_sync_status, last_sync_error, last_sync_count, last_synced_at
from public.api_platform_sync_connections
where id = 'TON_SYNC_CONN_ID';
```

Attendu:
- `last_sync_status = success`
- `last_sync_count > 0`

---

## 2) Valider les produits en mémoire agent

```sql
select count(*) as products_synced
from public.agent_external_data
where agent_id = 'TON_AGENT_UUID_EXTERNAL_SYNC'
  and data_type = 'product';
```

Attendu:
- `products_synced > 0`

Exemple d’aperçu:

```sql
select
  external_id,
  data->>'name' as name,
  data->>'price' as price,
  data->>'availability' as availability
from public.agent_external_data
where agent_id = 'TON_AGENT_UUID_EXTERNAL_SYNC'
  and data_type = 'product'
order by updated_at desc
limit 20;
```

---

## 3) Activer et valider l’auto-sync

Dans la carte `Sync catalogue`:
- Mettre `Auto-sync ON`
- Intervalle `5 min`
- Attendre 6 à 10 minutes

SQL de contrôle runs:

```sql
select
  trigger_source,
  status,
  fetched_count,
  synced_count,
  error,
  started_at,
  finished_at
from public.api_platform_sync_runs
where connection_id = 'TON_SYNC_CONN_ID'
order by created_at desc
limit 20;
```

Attendu:
- au moins une ligne `trigger_source = cron`
- `status = success`

---

## 4) Configurer le webhook Woo réel

Dans WooCommerce:
- `Settings` -> `Advanced` -> `Webhooks` -> `Add webhook`
- Topic: `Order created`
- Delivery URL: URL WazzapAI `.../api/public/v1/incoming/pwk_...` (pas localhost)
- Secret: `wsec_...` donné par WazzapAI
- Status: `Active`
- Sauvegarder

Puis passer une **commande réelle** test.

---

## 5) Valider réception webhook côté WazzapAI

```sql
select
  name,
  last_status_code,
  last_error,
  last_received_at
from public.api_platform_connections
where id = 'TON_PLATFORM_CONN_ID';
```

Attendu:
- `last_status_code = 200`
- `last_error is null`

---

## 6) Valider l’envoi WhatsApp

```sql
select
  id,
  recipient_phone,
  status,
  created_at,
  sent_at
from public.outbound_messages
where agent_id = 'TON_AGENT_UUID_EXTERNAL_SYNC'
order by created_at desc
limit 20;
```

Attendu:
- nouvelle ligne liée à la commande
- `status = sent`

---

## 7) Valider anti-doublon webhook

Rejouer le même événement Woo avec le même `delivery id`.

Attendu:
- pas de double envoi WhatsApp
- côté API, réponse rejouée idempotente (`x-idempotent-replayed: true` quand applicable)

---

## Critère Go/No-Go

Go si:
- sync manuelle OK
- auto-sync cron OK
- webhook Woo réel OK (200, sans erreur)
- message WhatsApp bien envoyé
- anti-doublon OK

No-Go si un de ces points échoue.

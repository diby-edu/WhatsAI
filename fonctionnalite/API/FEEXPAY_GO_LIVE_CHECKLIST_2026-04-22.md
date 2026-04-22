# FeexPay - Go-Live Checklist (Production)

## 1) Variables d'environnement (serveur)

Configurer dans `.env.local` (ou variables PM2) :

- `FEEXPAY_API_KEY=fp_...`
- `FEEXPAY_SHOP_ID=...`
- `FEEXPAY_API_BASE_URL=https://api-v2.feexpay.me/api`
- `FEEXPAY_STATUS_BASE_URL=https://api.feexpay.me/api`
- `FEEXPAY_DEFAULT_NETWORK=...` (ex: `wave_ci`, `mtn_ci`, `free_sn`)
- `FEEXPAY_DEFAULT_OTP=...` (seulement pour reseaux OTP)
- `NEXT_PUBLIC_APP_URL=https://wazzapai.com`
- `FEEXPAY_WEBHOOK_SECRET=` (laisser vide tant que la signature officielle n'est pas confirmee par FeexPay)

Option debug :

- `FEEXPAY_DEBUG_LOGS=1` (activer temporairement en recette uniquement)

## 2) Webhook FeexPay (dashboard FeexPay)

URL :

- `https://wazzapai.com/api/payments/feexpay/webhook`

Evenements :

- `transaction.successful` (obligatoire)
- `transaction.failed` (recommande)

Type d'en-tete :

- `Bearer` (ou `Basic` selon politique interne)

Valeur de l'en-tete :

- secret interne genere par vous (ex: `whsec_...`)  
  Remarque: actuellement cette valeur n'est pas encore verifiee nativement par le backend.

## 3) Tests avant ouverture client

1. Initier un paiement FeexPay depuis un panier test.
2. Verifier qu'une URL de paiement est retournee (ou fallback pending URL pour reseaux non coherents).
3. Finaliser le paiement cote operateur.
4. Verifier mise a jour `orders.status`/`payments.status`.
5. Verifier message WhatsApp de confirmation si applicable.

## 4) Requetes de controle SQL

Verifier les derniers paiements FeexPay :

```sql
select id, transaction_id, provider_transaction_id, payment_provider, status, created_at, updated_at
from public.orders
where payment_provider = 'feexpay'
order by created_at desc
limit 20;
```

Verifier les paiements globaux FeexPay :

```sql
select id, transaction_id, payment_provider, status, created_at, updated_at
from public.payments
where payment_provider = 'feexpay'
order by created_at desc
limit 20;
```

## 5) Logs a surveiller (VPS)

Webhook FeexPay :

```bash
grep -E "FeexPay Webhook|\\[FeexPay\\]" ~/.pm2/logs/whatsai-web-out.log ~/.pm2/logs/whatsai-web-error.log | tail -n 120
```

Queue WhatsApp :

```bash
grep -E "\\[OUTBOUND\\]|accepted by WhatsApp|Failed to send outbound" ~/.pm2/logs/whatsai-bot-out.log ~/.pm2/logs/whatsai-bot-error.log | tail -n 120
```

## 6) Signaux rouges (stop go-live)

- `401 Invalid signature` en boucle sur webhook FeexPay.
- croissance continue de paiements `pending` sans finalisation.
- accumulation `outbound_messages.status = pending`.
- absence de `provider_transaction_id` pour nouvelles transactions.

## 7) Rollback rapide

1. Basculer `defaultPaymentProvider` vers fournisseur precedent (admin settings).
2. Redemarrer `whatsai-web` uniquement.
3. Conserver les webhooks FeexPay desactives jusqu'au correctif.

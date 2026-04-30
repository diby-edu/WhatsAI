# WazzapAI x Shopify - Phase 1 (Go-live rapide)

## But
Mettre en production rapidement l'integration Shopify -> WazzapAI, sans construire d'app Shopify.

Mode retenu:
- Shopify envoie un webhook HTTPS vers WazzapAI.
- WazzapAI valide la signature HMAC Shopify.
- WazzapAI transforme l'evenement en trigger metier.
- WazzapAI enfile le message dans la queue WhatsApp.
- Le bot envoie le message.

---

## Quand choisir cette phase
- Vous voulez vendre tout de suite.
- Vous pouvez accepter une configuration manuelle par boutique.
- Vous n'avez pas encore besoin d'un "Connect Shopify en 1 clic".

---

## Prerequis

## Cote WazzapAI
- Agent actif et connecte WhatsApp.
- Connexion plateforme creee:
  - provider: `shopify`
  - agent cible: agent de la boutique
  - webhook token: `pwk_...` (genere)
  - signing secret: `wsec_...` (genere)

## Cote Shopify
- Boutique active.
- Acces admin Shopify.

---

## Setup exact (champ par champ)

Dans Shopify:
1. `Settings` -> `Notifications`.
2. Section `Webhooks` -> `Create webhook`.
3. Event: `Order creation`.
4. Format: `JSON`.
5. URL: `https://wazzapai.com/api/public/v1/incoming/pwk_...`
6. Secret: `wsec_...`
7. Save.

Attendu:
- Shopify accepte la config webhook.
- Si Shopify effectue un probe, WazzapAI repond proprement.

---

## Securite et fiabilite

## Securite
- Header attendu: `X-Shopify-Hmac-Sha256`.
- Signature recalculee cote WazzapAI et comparee en timing-safe.
- Si signature invalide: reject (401).

## Fiabilite
- Idempotence: dedoublonnage via identifiants webhook/event.
- Queue outbound: envoi resilient, pas de blocage request API publique.
- Logs d'entree: status, erreur, horodatage.

---

## Mapping utile (phase 1)

Webhook Shopify `orders/create` -> trigger `order_created`.

Champs utilises:
- client nom: `customer.first_name` + `customer.last_name`
- client phone: `customer.phone` (si absent -> evenement ignore pour envoi)
- reference commande: `name` (ex: `#CMD-9876`)
- total: `total_price`
- devise: `currency`

Note:
- Le template WazzapAI gere la reference avec un seul `#` (pas de `##`).

---

## Protocole de test production (obligatoire)

## Test A - Sanity webhook signe
Faire un POST signe (simulation VPS) vers l'URL incoming.
Attendu:
- HTTP 200
- `status = queued`

## Test B - Anti-doublon
Rejouer exactement le meme webhook (meme webhook id/event id).
Attendu:
- HTTP 200
- header `x-idempotent-replayed: true`

## Test C - Commande reelle Shopify
Creer une vraie commande dans Shopify avec numero client valide.
Attendu:
- `api_platform_connections.last_status_code = 200`
- `outbound_messages.status = sent`
- message recu sur WhatsApp

---

## Requetes de verification SQL

```sql
select
  name, provider, last_status_code, last_error, last_received_at
from public.api_platform_connections
where provider = 'shopify'
order by created_at desc
limit 5;
```

```sql
select
  id, recipient_phone, message_content, status, created_at, sent_at
from public.outbound_messages
where agent_id = 'AGENT_ID'
order by created_at desc
limit 20;
```

---

## Logs utiles VPS

```bash
grep -E "INCOMING\\]\\[PROBE|INCOMING\\]\\[SIGNATURE|OUTBOUND\\]|accepted by WhatsApp" \
~/.pm2/logs/whatsai-web-error.log \
~/.pm2/logs/whatsai-web-out.log \
~/.pm2/logs/whatsai-bot-out.log | tail -n 120
```

---

## Limites connues de la phase 1
- Setup manuel par boutique Shopify.
- Pas de bouton "Connect Shopify" natif dans Shopify.
- Pas de gestion OAuth/installation app.
- Support plus operationnel (guidage client) qu'en phase 2.

---

## Definition de succes phase 1
- 1 webhook `Order creation` configure et actif.
- 1 commande Shopify reelle traitee.
- 1 message WhatsApp livre.
- zero doublon sur rejeu identique.


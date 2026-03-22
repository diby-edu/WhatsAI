# AUDIT TECHNIQUE — PLAN D'ACTION COMPLET
**Date :** 2026-03-21
**Statut :** En cours
**Environnement :** PRODUCTION — ne pas casser l'existant
**Sources :** 4 audits croisés (Claude, Gemini, Antigravity, Codex VSCode) + vérification code réelle + résultats SQL

---

## RÈGLES DE BASE — PRODUCTION SAFETY

> Ces règles s'appliquent à CHAQUE modification, sans exception.

1. **Toujours lire le fichier avant de modifier** — jamais de modification à l'aveugle
2. **Un seul fichier à la fois** — pas de modifications simultanées dans plusieurs fichiers liés
3. **Tester localement avant de déployer** — lancer le bot en dev, simuler un message WhatsApp
4. **Committer séparément chaque fix** — un commit = une correction = un message de commit explicite
5. **Ne jamais supprimer une fonction sans vérifier tous ses imports** — utiliser `grep -rn "nomFonction"` avant toute suppression
6. **Les refactorisations (P2) ne doivent pas changer le comportement** — même entrée = même sortie, toujours
7. **Les fichiers legacy ne se suppriment pas à chaud** — on neutralise d'abord les imports, on vérifie en prod, on supprime ensuite
8. **En cas de doute : ne pas faire** — poser la question plutôt que de risquer une régression

---

## ACTIONS SQL DÉJÀ EXÉCUTÉES EN BASE ✅

Ces actions sont terminées et en production.

| Date | Action | Résultat |
|------|--------|----------|
| 2026-03-21 | `UNIQUE` sur `orders.transaction_id` | Race condition webhook paiement éliminée au niveau DB |
| 2026-03-21 | Index composite `conversations(agent_id, contact_phone)` | Requête getOrCreate conversation accélérée |
| 2026-03-21 | Index `orders(customer_phone)` | Historique commandes par client accéléré |

---

## P0 — BUGS ACTIFS EN PRODUCTION

> Risque de régression : **NUL** (corrections ciblées, pas de refacto)
> À déployer : **dès que possible, un par un**

---

### P0-1 — `voice_enabled` ≠ `enable_voice_responses`

**Problème :** `message.js` vérifie `agent.voice_enabled` mais le champ en base s'appelle `enable_voice_responses`. La voix ne fonctionne jamais.

**Fichier :** `src/lib/whatsapp/handlers/message.js`

**Procédure :**
1. Lire le fichier : `grep -n "voice_enabled\|enable_voice_responses" src/lib/whatsapp/handlers/message.js`
2. Remplacer chaque occurrence de `agent.voice_enabled` par `agent.enable_voice_responses`
3. Vérifier qu'il n'y a pas d'autre occurrence : `grep -rn "voice_enabled" src/`
4. Tester : envoyer un message WhatsApp avec un agent ayant la voix activée en DB
5. Committer : `fix: use correct field enable_voice_responses instead of voice_enabled`

**Vérification post-déploiement :** La réponse vocale est générée pour les agents avec `enable_voice_responses = true`

---

### P0-2 — Lien mort `/dashboard/messages`

**Problème :** Deux fichiers génèrent des liens vers `/dashboard/messages` qui n'existe pas. La route réelle est `/dashboard/conversations`.

**Fichiers confirmés par lecture :**
- `src/lib/notifications/notification.service.ts` lignes 149 et 155
- `src/lib/notifications/push-notifications.ts` ligne 127

**Procédure :**
1. Vérifier l'exhaustivité : `grep -rn "dashboard/messages" src/`
2. Dans `notification.service.ts` : remplacer les 2 occurrences `/dashboard/messages` → `/dashboard/conversations`
3. Dans `push-notifications.ts` : remplacer l'occurrence ligne 127
4. Re-vérifier : `grep -rn "dashboard/messages" src/` → doit retourner 0 résultats
5. Tester : déclencher une notification push et vérifier que le lien ouvre la bonne page
6. Committer : `fix: correct /dashboard/messages → /dashboard/conversations in notifications (2 files)`

---

### P0-3 — PII loggées dans les logs serveur ET dans Sentry

**Deux problèmes distincts dans `generator.js` :**

**P0-3a — Logs serveur (ligne ~56)** : `JSON.stringify(args)` dans `preCheckCreateOrder()` logue en clair le nom, téléphone et adresse du client.

**P0-3b — Sentry (lignes 438-441)** : `customerPhone` est envoyé en clair à Sentry (service externe). **Plus grave que P0-3a** car les données quittent l'infrastructure.

**Fichier :** `src/lib/whatsapp/ai/generator.js`

**Procédure :**
1. Lire les deux sections : `sed -n '50,65p' src/lib/whatsapp/ai/generator.js` et `sed -n '433,445p' src/lib/whatsapp/ai/generator.js`
2. **P0-3a — Masquer dans les logs :**
   ```javascript
   const safeArgs = { ...args }
   if (safeArgs.customer_name) safeArgs.customer_name = '***'
   if (safeArgs.customer_phone) safeArgs.customer_phone = '***'
   if (safeArgs.delivery_address) safeArgs.delivery_address = '***'
   if (safeArgs.email) safeArgs.email = '***'
   console.log(JSON.stringify(safeArgs, null, 2))
   ```
3. **P0-3b — Masquer dans Sentry :**
   ```javascript
   extra: {
       agentId: options.agent?.id,
       customerPhone: options.customerPhone ? '***' : undefined,
       messageLength: options.userMessage?.length
   }
   ```
4. Vérifier l'exhaustivité : `grep -n "stringify(args\|customerPhone\|customer_name\|delivery_address" src/lib/whatsapp/ai/generator.js`
5. Tester : passer une commande en dev, vérifier logs ET Sentry
6. Committer : `fix: mask PII in create_order logs and Sentry (GDPR)`

---

### P0-4 — N+1 Supabase dans la déduction de stock

**Problème :** `tool-orders.js` fait 1 requête SELECT Supabase par produit dans une boucle. 10 produits = 10 requêtes séquentielles au lieu d'une seule.

**Fichier :** `src/lib/whatsapp/ai/tools/tool-orders.js` lignes 220-272

**Important :** La boucle fait 3 opérations par produit : SELECT stock, UPDATE combinations, UPDATE stock_quantity. **Seul le SELECT peut être batché** — les UPDATEs restent individuels (logique différente par produit). Ne pas tenter de batcher les writes.

**Procédure :**
1. Lire la section : `sed -n '215,280p' src/lib/whatsapp/ai/tools/tool-orders.js`
2. Identifier le SELECT en début de boucle : `supabase.from('products').select('stock_quantity, name, combinations').eq('id', resolved.id).single()`
3. **Extraire le SELECT avant la boucle :**
   ```javascript
   // AVANT (N+1 selects) :
   for (const resolved of resolvedProducts) {
       const { data: prod } = await supabase
           .from('products')
           .select('stock_quantity, name, combinations')
           .eq('id', resolved.id)
           .single()
       // ... updates avec prod
   }

   // APRÈS (1 select, updates inchangés) :
   const productIds = resolvedProducts.map(r => r.id)
   const { data: allProds } = await supabase
       .from('products')
       .select('id, stock_quantity, name, combinations')
       .in('id', productIds)
   const prodMap = new Map((allProds || []).map(p => [p.id, p]))

   for (const resolved of resolvedProducts) {
       const prod = prodMap.get(resolved.id)
       if (!prod) continue
       // ... même logique d'update qu'avant, SANS CHANGER les supabase.update()
   }
   ```
4. **Vérifier** que les UPDATEs à l'intérieur de la boucle sont strictement identiques à avant
5. Tester : passer une commande avec 2+ produits différents, vérifier le stock en DB après
6. Committer : `perf: batch product SELECT before stock deduction loop in tool-orders`

---

### P0-5 — `contact_phone` ≠ `customer_phone` dans les tools IA

**Problème confirmé par lecture du code :**
- `openai.ts:337` → définit le tool `create_order` avec `contact_phone`
- `tool-orders.js:23` → destructure `customer_phone` depuis les args → reçoit `undefined`
- `definitions.js:40` → définit `customer_phone`

L'IA envoie `contact_phone`, le handler lit `customer_phone` → valeur manquante à chaque commande.

**Note :** `agents.contact_phone` (DB) = téléphone pro de l'agent — sans rapport. Ne pas confondre.

**Fichier à modifier : uniquement `src/lib/ai/openai.ts`** (les autres sont corrects)

**Procédure :**
1. `grep -n "contact_phone" src/lib/ai/openai.ts`
2. Remplacer dans la définition du tool `create_order` :
   - `contact_phone` → `customer_phone` (dans `properties` et dans `required`)
3. Vérifier qu'aucune autre référence à `contact_phone` dans ce contexte : `grep -n "contact_phone" src/lib/ai/openai.ts`
4. **Ne pas toucher** `definitions.js`, `tool-orders.js` — ils sont corrects
5. Tester : passer une commande complète via WhatsApp, vérifier que `customer_phone` est bien enregistré en DB
6. Committer : `fix: rename contact_phone to customer_phone in openai.ts create_order tool definition`

---

### P0-6 — `admin-notify.ts` (push + email + DB) ≠ `admin-notify.js` (push uniquement)

**Problème confirmé par lecture :** Les deux fichiers existent par design (deux runtimes différents) mais leur comportement diverge :
- `admin-notify.ts` : push + email + persist en DB `admin_notifications` (bell de l'admin) — utilisé par Next.js
- `admin-notify.js` : push uniquement, **sans email, sans persist DB** — utilisé par le bot WhatsApp (CommonJS require)

**Conséquence :** Quand une commande est créée via le bot, l'admin reçoit une push mais **pas d'email et la notification n'apparaît pas dans la cloche**.

**⚠️ NE PAS supprimer `admin-notify.js`** — il est requis par le runtime Node.js du bot (session.js, ai.service.js, conversation.service.js ne peuvent pas importer du TypeScript).

**Procédure :**
1. Lire les deux fichiers en entier pour lister les différences exactes
2. Dans `admin-notify.js` : ajouter le persist DB vers `admin_notifications` (copier la logique de la section "Persist event" du `.ts`)
3. Dans `admin-notify.js` : ajouter l'envoi email via nodemailer (ou via un appel HTTP interne vers une API route Next.js)
4. Tester : créer une commande depuis WhatsApp, vérifier que la notif apparaît dans la cloche admin ET que l'email est reçu
5. Committer : `fix: add DB persist and email to admin-notify.js (bot runtime)`

---

## P1 — DETTE STRUCTURELLE URGENTE

> Risque de régression : **Faible** (pas de logique métier changée)
> À faire : **dans les 2 semaines suivant P0**
> **Règle :** chaque item P1 = branche Git séparée + PR + review avant merge

---

### P1-7 — Race condition webhook CinetPay (côté code)

**Contexte :** La contrainte UNIQUE DB est déjà en place (fait en SQL). Un guard partiel existe déjà : `route.ts:146-148` vérifie `if (order.status === 'paid' || order.status === 'completed') return`. Ce guard ne protège PAS contre la race condition (deux webhooks simultanés passent le check avant que l'un des deux écrive). Il faut en plus le try/catch sur l'erreur DB.

**Fichier :** `src/app/api/payments/cinetpay/webhook/route.ts`

**Procédure :**
1. Lire la section qui fait `update orders status = 'paid'`
2. Wrapper dans un try/catch qui intercepte l'erreur de contrainte UNIQUE :
   ```javascript
   try {
       // ... update order paid
   } catch (err) {
       if (err?.code === '23505') {
           // Contrainte UNIQUE violée = doublon de webhook = déjà traité
           console.log('[Webhook] Duplicate transaction ignored:', transactionId)
           return NextResponse.json({ received: true }, { status: 200 })
       }
       throw err // Re-lancer les autres erreurs
   }
   ```
3. Ajouter vérification timestamp freshness (rejeter webhooks > 10 min) :
   ```javascript
   const transDate = formData.get('cpm_trans_date') // format: YYYYMMDDHHMMSS
   if (transDate) {
       const parsed = parseTransDate(transDate) // à implémenter
       if (Date.now() - parsed > 10 * 60 * 1000) {
           console.warn('[Webhook] Stale webhook rejected:', transactionId)
           return NextResponse.json({ received: true }, { status: 200 })
       }
   }
   ```
4. Tester : simuler deux webhooks identiques en rapide succession
5. Committer : `fix: handle duplicate webhook with UNIQUE constraint error (23505)`

---

### P1-8 — Validation entrées IA (`tool-orders.js`)

**Problème :** `item.product_name` vient directement de l'IA sans validation de longueur.

**Fichier :** `src/lib/whatsapp/ai/tools/tool-orders.js` ligne 91

**Procédure :**
1. Localiser : `grep -n "product_name\|searchName" src/lib/whatsapp/ai/tools/tool-orders.js | head -10`
2. Ajouter trim + limite de longueur avant usage :
   ```javascript
   const searchName = (item.product_name || '').trim().slice(0, 200).toLowerCase()
   ```
3. Tester : envoyer un message très long depuis WhatsApp
4. Committer : `fix: sanitize product_name input from AI (trim + length limit)`

---

### P1-9 — Masquer IP client dans les logs webhook

**Fichier :** `src/app/api/payments/cinetpay/webhook/route.ts` ligne 109

**Procédure :**
1. `grep -n "x-forwarded-for\|remoteAddress\|ip" src/app/api/payments/cinetpay/webhook/route.ts`
2. Remplacer le log de l'IP complète par une version tronquée :
   ```javascript
   const ip = request.headers.get('x-forwarded-for') || 'unknown'
   const maskedIp = ip.split('.').slice(0, 2).join('.') + '.*.*'
   console.warn('[Webhook] Request from:', maskedIp)
   ```
3. Committer : `fix: mask client IP in webhook logs`

---

### P1-10 — OpenAI timeout global

**Problème :** Aucun timeout sur le client OpenAI. Une requête peut bloquer indéfiniment.

**Fichier :** `src/lib/ai/openai.ts`

**Procédure :**
1. Lire la création du client OpenAI : `grep -n "new OpenAI\|OpenAI({" src/lib/ai/openai.ts`
2. Ajouter `timeout` :
   ```javascript
   const openai = new OpenAI({
       apiKey: process.env.OPENAI_API_KEY,
       timeout: 30_000, // 30 secondes max
   })
   ```
3. Tester : vérifier qu'une requête normale fonctionne toujours
4. Committer : `fix: add 30s timeout to OpenAI client`

---

### P1-11 — Améliorer la détection de clé OpenAI absente

**Situation réelle vérifiée :** `openai.ts:8-12` a déjà un `console.warn` si la clé est absente. Le `dummy_key_for_build` permet au build Next.js de passer (les env vars runtime ne sont pas disponibles au build). Un `throw` nu casserait le build.

**Fichier :** `src/lib/ai/openai.ts`

**Procédure :**
1. `sed -n '6,16p' src/lib/ai/openai.ts`
2. Garder le `console.warn` existant, ajouter un `throw` conditionnel au runtime uniquement :
   ```typescript
   if (!process.env.OPENAI_API_KEY) {
       if (process.env.NODE_ENV === 'production') {
           throw new Error('[OpenAI] OPENAI_API_KEY is not set in production.')
       }
       console.warn('⚠️ OPENAI_API_KEY is not set. OpenAI features will fail at runtime.')
   }
   ```
3. **Vérifier** que la clé est définie sur le VPS avant de déployer
4. Committer : `fix: throw in production if OPENAI_API_KEY missing`

---

### P1-12 — `writeData()` sans retry dans supabase-auth.js

**Problème corrigé après vérification :** Le `catch` n'est PAS silencieux — `supabase-auth.js:24` logue déjà `console.error('[SupabaseAuth] Failed to save key ${key}:', error)`. Le vrai problème est l'**absence de retry** : si la sauvegarde échoue une fois, les credentials Baileys ne sont pas persistés → désynchronisation → QR scan forcé au prochain redémarrage.

**Fichier :** `src/lib/whatsapp/supabase-auth.js`

**Procédure :**
1. Lire : `sed -n '10,35p' src/lib/whatsapp/supabase-auth.js`
2. Ajouter un retry simple (1 tentative supplémentaire après 1s) :
   ```javascript
   } catch (error) {
       console.error(`[SupabaseAuth] Failed to save key ${key} (attempt 1):`, error.message)
       // Retry une fois après 1s
       try {
           await new Promise(r => setTimeout(r, 1000))
           await supabase.from('whatsapp_sessions').upsert({ ... }).throwOnError()
       } catch (retryError) {
           console.error(`[SupabaseAuth] Retry failed for key ${key} — QR scan may be required on next restart:`, retryError.message)
       }
   }
   ```
3. Tester : vérifier que le log apparaît en cas d'erreur réseau simulée
4. Committer : `fix: add retry on writeData failure in supabase-auth.js`

---

### P1-13 — Archiver uniquement `message-handler.ts`

**⚠️ CORRECTION IMPORTANTE :** `baileys.ts` N'EST PAS à archiver. Il est utilisé en production par :
- `src/app/api/bookings/[id]/status/route.ts` → `sendWhatsAppMessage`
- `src/app/api/orders/[id]/status/route.ts` → `sendWhatsAppMessage`
- `src/app/api/whatsapp/send/route.ts` → `sendWhatsAppMessage`, `sendMessageWithTyping`, `getSessionStatus`
- `src/lib/payments/digital-delivery.ts` → `sendWhatsAppMessage`
- `src/lib/whatsapp/index.ts` → re-exports
- `src/lib/whatsapp/session-restore.ts` → `initWhatsAppSession`

**Seul `message-handler.ts` est legacy** (handler de messages remplacé par la stack JS).

**ORDRE OBLIGATOIRE — ne pas inverser :**

**Étape A — Vérifier que `message-handler.ts` n'est plus utilisé :**
```bash
grep -rn "message-handler" src/ whatsapp-service.js
```
Confirmer que seul `baileys.ts` l'importe (import conditionnel legacy).

**Étape B — Neutraliser l'import dans `baileys.ts` :**
1. Lire `src/lib/whatsapp/baileys.ts` : identifier le import conditionnel de `message-handler.ts`
2. Commenter le import uniquement (ne pas toucher à `baileys.ts` autrement) :
   ```typescript
   // LEGACY - neutralisé 2026-03-21 — remplacé par handlers/message.js
   // import { initializeMessageHandler } from './message-handler'
   ```

**Étape C — Déployer et surveiller 48h :**
- Vérifier que le bot répond normalement
- Vérifier dans les logs qu'aucune erreur liée à `message-handler` n'apparaît

**Étape D — Après 48h sans incident :**
```bash
mkdir -p legacy/
mv src/lib/whatsapp/message-handler.ts legacy/
```
Committer : `chore: archive legacy message-handler.ts (replaced by handlers/message.js)`

**`baileys.ts` reste en place — ne pas y toucher.**

---

### P1-14 — Supprimer les fichiers de pollution du repo

**Fichiers confirmés par `ls` :**
- `debug_conversations.js`, `debug_orders.js`, `debug_product.js` (racine) ✅
- `tools-v26.js`, `prompt-builder-v28-hotfix.js`, `format-v28-hotfix.js` (racine) ✅
- `run_sql_query.js` (racine) ✅
- `src/lib/whatsapp/handlers/message.js.old` ✅
- Dossiers : `ANALYSE DE L'AURE EXPERT/`, `PACKAGE AUDI COMPLET/`, `PACK FIX/`, `PACK FIX 1/`
- APKs `WazzapAI-v2` à `WazzapAI-v7` (si dans le repo Git — à vérifier avec `git ls-files | grep .apk`)

**Procédure :**
1. `git status` — vérifier que ces fichiers ne sont pas dans des imports actifs
2. `grep -rn "debug_conversations\|debug_orders\|tools-v26\|prompt-builder-v28" src/ whatsapp-service.js` → doit retourner 0 résultats
3. Supprimer
4. Ajouter au `.gitignore` : `*.apk`, `debug_*.js`, `PACK FIX*/`
5. Committer : `chore: remove debug files, hotfix copies and APKs from repo`

---

### P1-15 — Consolider vers `currency.ts` existant

**⚠️ CORRECTION :** `src/lib/currency.ts` EXISTE DÉJÀ avec :
- Devises : `XOF: 1, FCFA: 1, USD: 700, EUR: 700` — **pas de GBP** (non nécessaire)
- Fonctions : `convertFromFcfa()`, `convertToFcfa()`, `formatPriceFromFcfa()` — déjà complètes
- Taux retenus : **700 pour USD et EUR** (couvre les frais de change)

**Problème :** `cart-state.service.js:23` a sa propre copie `{ USD: 700, EUR: 700, GBP: 800 }` et `openai.ts:140` utilise `price_fcfa * 0.92` au lieu d'importer `currency.ts`.

**Devises supportées : XOF (FCFA), USD ($), EUR (€) uniquement.** La devise est celle configurée sur l'agent/profil utilisateur.

**Procédure :**
1. Dans `cart-state.service.js` :
   - Supprimer les constantes locales `CURRENCY_RATES` et `CURRENCY_SYMBOLS` (lignes ~23-25)
   - Remplacer `formatPrice(priceFcfa, currency)` par un import de `formatPriceFromFcfa` depuis `src/lib/currency.ts`
   - **Vérifier** que toutes les occurrences de `formatPrice` sont remplacées : `grep -n "formatPrice" src/lib/whatsapp/services/cart-state.service.js`

2. Dans `openai.ts:140` :
   - **Note importante :** Le `* 0.92` est un bug de logique — appliquer 0.92 à un prix en FCFA donne un résultat absurde (ex: 5000 FCFA × 0.92 = 4600, pas des euros). La vraie conversion est `price_fcfa / 700` (1 EUR = 700 FCFA).
   - Supprimer le bloc `if (options.currency === 'EUR') { displayPrice = Math.round(p.price_fcfa * 0.92 * 100) / 100 }`
   - Remplacer par : `import { convertFromFcfa } from '@/lib/currency'` puis `displayPrice = convertFromFcfa(p.price_fcfa, options.currency)`
   - `convertFromFcfa` applique `price_fcfa / 700` pour EUR et USD — cohérent avec `currency.ts`
   - Vérifier les cas USD et XOF aussi pour les unifier

3. Tester : vérifier l'affichage des prix en XOF, USD et EUR
4. Committer : `refactor: use existing src/lib/currency.ts in cart-state and openai (remove duplicate rates, remove GBP)`

---

### P1-16 — `profiles.currency` comme source de la devise

**Problème :** La devise de l'utilisateur est déjà stockée en DB (`profiles.currency`) mais pas utilisée. Le code utilise des devises hardcodées.

**Procédure :**
1. Vérifier comment `agent` est chargé dans `message.js` et s'il inclut les données du profil
2. Si `agent.user.currency` est disponible, passer ce champ à `updateCartStateFromUserMessage`
3. Si non disponible, charger `profiles.currency` lors du chargement de l'agent
4. Remplacer le paramètre `currency` hardcodé par `agent.user.currency || 'XOF'`
5. Tester avec un compte ayant `currency = 'EUR'`
6. Committer : `feat: use profiles.currency as default currency for cart display`

---

### P1-17 — Source unique pour la limite d'agents par plan

**Problème confirmé par lecture :** `finalization.ts:342` définit en dur `{ free: 1, starter: 1, pro: 3, business: 6, scale: -1 }`. `plans.ts` contient la même donnée via `PLANS[id].agents` mais sans fonction utilitaire exportée.

**Procédure :**
1. Dans `src/lib/plans.ts`, ajouter une fonction exportée :
   ```typescript
   export function getPlanAgentLimit(planId: string): number {
       return PLANS[planId as PlanId]?.agents ?? 1
   }
   ```
2. Dans `src/lib/payments/finalization.ts` :
   - Ajouter l'import : `import { getPlanAgentLimit } from '@/lib/plans'`
   - Supprimer le bloc `const planAgentLimits = { free: 1, ... }`
   - Remplacer `planAgentLimits[plan.id] ?? 1` par `getPlanAgentLimit(plan.id)`
3. Vérifier : `grep -rn "planAgentLimits" src/` → 0 résultat
4. Vérifier que TypeScript compile : `npx tsc --noEmit`
5. Committer : `refactor: replace inline planAgentLimits with getPlanAgentLimit() from plans.ts`

---

### P1-18 — Typer `SupabaseClientLike = any`

**Fichier :** `src/lib/payments/finalization.ts` ligne 18

**Procédure :**
1. `sed -n '15,25p' src/lib/payments/finalization.ts`
2. Remplacer `type SupabaseClientLike = any` par le vrai type :
   ```typescript
   import type { SupabaseClient } from '@supabase/supabase-js'
   import type { Database } from '@/lib/supabase/database.types'
   type SupabaseClientLike = SupabaseClient<Database>
   ```
3. Corriger les erreurs TypeScript qui apparaissent (sans changer la logique)
4. Committer : `fix: type SupabaseClientLike correctly in finalization.ts`

---

### P1-19 — Mettre à jour `database.ts` (types TypeScript)

**Problème :** `database.ts` ne reflète pas le vrai schéma. Colonnes manquantes identifiées par SQL.

**Colonnes à ajouter dans les types `agents` :**
`whatsapp_status`, `whatsapp_qr_code`, `whatsapp_phone_number`, `enable_voice_responses`, `voice_id`, `archived_at`, `archived_reason`, `is_online_only`, `agent_tone`, `agent_goal`, `custom_rules`, `latitude`, `longitude`, `payment_mode`, `mobile_money_orange`, `mobile_money_mtn`, `mobile_money_wave`, `custom_payment_methods`, `escalation_phone`, `last_message_at`

**Colonnes confirmées correctes :**
- `orders.customer_phone` ✅, `orders.total_fcfa` ✅, `orders.transaction_id` ✅
- `profiles.currency` ✅, `profiles.plan` (text, pas enum) ✅
- `subscriptions.plan` (text, pas enum) ✅

**Fichier confirmé par `find` :** `src/types/database.ts`

**Procédure :**
1. Lire : `cat src/types/database.ts`
2. Ajouter les colonnes manquantes pour la table `agents`
3. **Ne pas changer** les types existants corrects
4. Vérifier que TypeScript compile sans erreur : `npx tsc --noEmit`
5. Committer : `fix: update src/types/database.ts to match actual Supabase schema`

---

### P1-20 — Réduire `select('*')` sur agents et products

**Deux occurrences confirmées par grep dans `message.js` :**
- **Ligne 205** : `select('*')` sur la table `agents` — charge `system_prompt` (potentiellement plusieurs Ko) à chaque message
- **Ligne 341** : `select('*')` sur la table `products` — charge des colonnes inutiles (combinations JSONB complet, etc.)

**Fichier :** `src/lib/whatsapp/handlers/message.js` lignes 205 et 341

**Procédure :**
1. `sed -n '200,215p' src/lib/whatsapp/handlers/message.js`
2. `sed -n '336,350p' src/lib/whatsapp/handlers/message.js`
3. **Ligne 205 — agents** : identifier toutes les propriétés `agent.*` utilisées dans `message.js` (`grep -n "agent\." src/lib/whatsapp/handlers/message.js | grep -v "//\|agentId\|agentCurrency"`)
4. Remplacer le premier `.select('*')` (agents) par la liste explicite des colonnes utilisées :
   ```javascript
   .select('id, user_id, name, system_prompt, model, temperature, max_tokens, enable_voice_responses, voice_id, use_emojis, response_delay_seconds, language, welcome_message, whatsapp_connected, whatsapp_phone, is_active, payment_mode, mobile_money_orange, mobile_money_mtn, mobile_money_wave, escalation_phone, agent_tone, agent_goal, custom_rules, currency')
   ```
5. **Ligne 341 — products** : identifier les colonnes produits réellement utilisées dans le handler
6. Remplacer le second `.select('*')` (products) par la liste minimale (exclure `combinations`, `search_vector`, `related_product_ids` si non utilisés dans le handler directement)
7. Tester : un message complet fonctionne (chat, commande, booking)
8. Committer : `perf: replace select(*) on agents and products with explicit column lists`

---

### P1-21 — Validation Zod sur routes API critiques

**Problème :** 50+ routes font `await request.json()` sans validation de schéma.

**⚠️ Zod n'est PAS installé** — l'installer d'abord : `npm install zod`

**Priorité des routes à couvrir en premier :**
1. `src/app/api/payments/` (paiements)
2. `src/app/api/agents/` (création/modification agents)
3. `src/app/api/payments/cinetpay/webhook/route.ts` (webhook)
4. `src/app/api/admin/users/[id]/route.ts`
5. `src/app/api/admin/subscriptions/[id]/route.ts`

**Procédure pour chaque route :**
1. Installer Zod une seule fois : `npm install zod` (non installé — à faire avant tout)
2. Lire la route, identifier les champs attendus du `request.json()`
3. Ajouter la validation :
   ```typescript
   import { z } from 'zod'

   const schema = z.object({
       field1: z.string().min(1).max(200),
       field2: z.number().positive(),
   })

   const body = await request.json()
   const parsed = schema.safeParse(body)
   if (!parsed.success) {
       return NextResponse.json({ error: 'Invalid input', details: parsed.error.errors }, { status: 400 })
   }
   const { field1, field2 } = parsed.data
   ```
4. Tester que les appels légitimes passent toujours
5. Committer par route : `fix: add Zod validation to [nom] API route`

---

## P2 — QUALITÉ & PERFORMANCE

> Risque de régression : **Modéré**
> **Règle absolue :** tester en environnement de dev complet avant déploiement
> **Règle absolue :** chaque refactorisation = comportement identique garanti

---

### P2-22 — ~~`Promise.all` pour sentiment + génération IA~~ — SUPPRIMÉ

**⚠️ Item supprimé après vérification du code.**

`analyzeSentiment` est appelé avant `AIService.generate` et son résultat détermine si on appelle l'IA du tout : si `conversation.shouldEscalate(sentimentAnalysis)` est vrai → `return` immédiat, pas d'appel IA. Paralléliser déclencherait un appel OpenAI inutile sur chaque message d'un client en colère.

La séquence actuelle est correcte et ne peut pas être parallélisée sans changer la logique métier.

---

### P2-23 — `analyzeLeadQuality` en background

**Problème :** Appel OpenAI supplémentaire synchrone (tous les 5 messages) qui ajoute de la latence visible pour le client.

**Fichier :** `src/lib/whatsapp/handlers/message.js`

**Fichier :** `src/lib/whatsapp/handlers/message.js` ligne 624-637

**Procédure :**
1. Lire le bloc exact : `sed -n '623,640p' src/lib/whatsapp/handlers/message.js`
2. Convertir en fire-and-forget (conserver la logique DB à l'intérieur) :
   ```javascript
   // AVANT (bloquant — ligne 624)
   if ((conversationHistory.length + 1) % 5 === 0) {
       const leadAnalysis = await AnalyticsService.analyzeLeadQuality(openai, conversationHistory)
       if (leadAnalysis) {
           await supabase.from('conversations').update({
               lead_status: leadAnalysis.status,
               lead_score: leadAnalysis.score,
               lead_notes: leadAnalysis.reasoning
           }).eq('id', conversation.id)
       }
   }

   // APRÈS (non-bloquant)
   if ((conversationHistory.length + 1) % 5 === 0) {
       const convId = conversation.id // capturer avant setImmediate
       setImmediate(async () => {
           try {
               const leadAnalysis = await AnalyticsService.analyzeLeadQuality(openai, conversationHistory)
               if (leadAnalysis) {
                   await supabase.from('conversations').update({
                       lead_status: leadAnalysis.status,
                       lead_score: leadAnalysis.score,
                       lead_notes: leadAnalysis.reasoning
                   }).eq('id', convId)
               }
           } catch (err) {
               console.error('[LeadQuality] Background analysis failed:', err.message)
           }
       })
   }
   ```
3. Tester : envoyer 5 messages, vérifier que `lead_score` est mis à jour en DB (asynchronement)
4. Committer : `perf: run analyzeLeadQuality as background task (setImmediate)`

---

### P2-24 — Middleware : éviter la requête DB par navigation

**Problème :** `middleware.ts` charge `profiles` (role, phone, onboarding) à chaque page protégée.

**Procédure :**
1. Lire `src/middleware.ts` lignes 85-125
2. Après le chargement initial du profil, encoder dans un cookie signé (durée 5 min) :
   ```typescript
   // Après query Supabase réussie :
   const profileData = { role, phone, onboarding_completed, exp: Date.now() + 5 * 60 * 1000 }
   // Stocker en cookie (à chiffrer avec crypto.subtle ou jose)
   response.cookies.set('__profile_cache', JSON.stringify(profileData), {
       httpOnly: true, secure: true, sameSite: 'lax', maxAge: 300
   })
   ```
3. Lire le cookie en priorité, ne requêter Supabase qu'en cas d'expiration ou absence
4. Invalider le cookie lors d'un changement de profil (update profile API)
5. **Tester soigneusement** : connexion, déconnexion, changement de rôle
6. Committer : `perf: cache profile in cookie to avoid DB query per navigation`

---

### P2-25 — Filtre date sur l'historique RAG

**Problème :** Les 20 dernières commandes sont chargées sans limite de date. Un client ancien voit 2 ans d'historique injectés dans le prompt.

**Fichier :** `src/lib/whatsapp/handlers/message.js` lignes 395-408

**Note confirmée par lecture :** La requête filtre sur `user_id` (l'owner de l'agent), pas sur `agent_id`. Cela signifie qu'un client peut voir des commandes passées via n'importe quel agent du même user. Ce comportement est intentionnel (historique cross-agents pour le même marchand). Ne pas changer le filtre `user_id`.

**Procédure :**
1. Localiser la requête `.limit(20)` sur les commandes
2. Ajouter un filtre à 90 jours uniquement :
   ```javascript
   const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
   const { data: recentOrders } = await supabase
       .from('orders')
       .select(...)
       .eq('user_id', agent.user_id)
       .eq('customer_phone', normalizedContactPhone)
       .gte('created_at', ninetyDaysAgo)  // ← ajout uniquement
       .order('created_at', { ascending: false })
       .limit(20)
   ```
3. Tester avec un client ayant des commandes de plus de 90 jours
4. Committer : `fix: limit order history to 90 days in RAG context`

---

### P2-26 — Monitoring budget OpenAI

**Procédure :**
1. Dans `generator.js`, après chaque appel OpenAI, logger les tokens :
   ```javascript
   console.log('[OpenAI] Tokens used:', {
       prompt: response.usage?.prompt_tokens,
       completion: response.usage?.completion_tokens,
       total: response.usage?.total_tokens,
       agentId: agent?.id
   })
   ```
2. À terme : stocker en DB pour dashboard coûts par agent

---

### P2-27 — `process.exit(1)` sans flush sur `uncaughtException`

**Fichier :** `whatsapp-service.js` lignes 7-11

**Contexte confirmé par lecture :** `gracefulShutdown` (appelé sur SIGINT/SIGTERM) a déjà un `setTimeout(2000)` avant `process.exit(0)`. Le problème concerne **uniquement** le handler `uncaughtException` (ligne 10) qui fait `process.exit(1)` immédiatement sans délai.

**Procédure :**
1. `sed -n '7,13p' whatsapp-service.js` — lire le handler exact
2. Ajouter le délai uniquement dans `uncaughtException` :
   ```javascript
   process.on('uncaughtException', async (err) => {
       console.error('💥 UNCAUGHT EXCEPTION:', err.message, err.stack)
       console.error('Allowing 2s for in-flight messages to complete...')
       await new Promise(resolve => setTimeout(resolve, 2000))
       process.exit(1)
   })
   ```
3. **Ne pas toucher** à `gracefulShutdown` — il est déjà correct
4. Committer : `fix: add 2s drain before process.exit(1) on uncaughtException`

---

### P2-28 — Épingler la version Baileys

**Fichier :** `package.json`

**Procédure :**
1. Remplacer `"^7.0.0-rc.9"` par `"7.0.0-rc.9"` (retirer le `^`)
2. Cela empêche une mise à jour automatique vers une RC cassante
3. Committer : `chore: pin baileys to exact version 7.0.0-rc.9`

---

### P2-29 — Guard `activeSessions` concurrent

**Fichier :** `whatsapp-service.js`

**Contexte confirmé par lecture :** Le guard existe déjà à la ligne 129 dans `scheduleSessionInit` :
```javascript
if (activeSessions.has(agent.id) || pendingConnections.has(agent.id) || scheduledConnections.has(agent.id)) return
```
Ce guard couvre le chemin principal de création de session.

**Action restante :** Vérifier si `session.js:initSession` a aussi un guard interne, ou si un appel direct à `initSession` (hors `scheduleSessionInit`) peut contourner la protection.

**Procédure :**
1. `grep -n "initSession\|activeSessions.set\|activeSessions.has" src/lib/whatsapp/handlers/session.js whatsapp-service.js`
2. Si `initSession` est appelé directement ailleurs sans passer par `scheduleSessionInit` → ajouter le guard au début de `initSession` aussi
3. Si tous les appels passent par `scheduleSessionInit` → aucune action nécessaire, item déjà couvert
4. Committer uniquement si une lacune est trouvée : `fix: guard concurrent session init in session.js`

---

### P2-30 — `updateMetadata()` atomic

**Problème :** Read-merge-write dans `conversation.service.js:192-210` — race condition si deux messages arrivent en même temps.

**Procédure :**
1. Créer une fonction RPC Supabase pour le merge atomic :
   ```sql
   -- À exécuter dans Supabase SQL Editor
   CREATE OR REPLACE FUNCTION merge_conversation_metadata(
       conv_id UUID,
       updates JSONB
   ) RETURNS void AS $$
   BEGIN
       UPDATE conversations
       SET metadata = COALESCE(metadata, '{}'::jsonb) || updates,
           updated_at = NOW()
       WHERE id = conv_id;
   END;
   $$ LANGUAGE plpgsql;
   ```
2. Dans `conversation.service.js`, remplacer le read-merge-write par :
   ```javascript
   const { error } = await supabase.rpc('merge_conversation_metadata', {
       conv_id: conversationId,
       updates: updates  // JSONB patch, pas le merged complet
   })
   ```
3. Tester avec des messages simultanés sur la même conversation
4. Committer : `fix: atomic metadata merge via Supabase RPC`

---

### P2-31 à P2-35 — Centralisation utilitaires

**P2-31 — `normalizeText()` × 3 :**
1. Créer `src/lib/whatsapp/utils/text-utils.js` avec la version la plus complète
2. `grep -rn "function normalizeText\|normalizeText = " src/lib/whatsapp/services/`
3. Remplacer dans les 3 services par un import
4. Committer : `refactor: centralize normalizeText in text-utils.js`

**P2-32 — `isPositiveReply()` / `isNegativeReply()` × 3 :**
Même procédure, même fichier `text-utils.js`

**P2-33 — Pattern `clone/get/set/clear` × 3 :**
Extraire un helper `StateManager(key)` partagé par les 3 services

**P2-34 — Pricing dupliqué :**
Extraire `src/lib/whatsapp/utils/pricing-engine.js` avec `calculateItemPrice()`

**P2-35 — Magic numbers → `constants.js` :**
Créer `src/lib/whatsapp/constants.js` :
```javascript
// Scores de matching produit
export const MATCH_SCORE_EXACT = 120
export const MATCH_SCORE_INCLUDES = 70
export const MATCH_SCORE_WORD = 30
export const MATCH_SCORE_MIN = 15

// Lead analysis
export const LEAD_ANALYSIS_EVERY_N_MESSAGES = 5

// Crédits
export const CREDITS_TTS = 4

// Stock
export const STOCK_UNLIMITED = 100
export const STOCK_OUT = -1
```

---

### P1-22 — Dualité `openai.ts` tools vs `definitions.js`

**Problème confirmé :** `openai.ts:298-356` définit ses propres tools (`create_booking`, `send_image`, `create_order`) en parallèle de `definitions.js`. Ce sont deux contrats distincts. Modifier l'un ne change pas l'autre → désynchronisation garantie.

**Contexte :** `openai.ts` = stack TypeScript legacy (utilisée par `generateAIResponse`). `definitions.js` = stack JS production (utilisée par `generator.js` via `AIService`). Les deux coexistent actuellement.

**Procédure :**
1. `grep -n "create_order\|create_booking\|send_image" src/lib/ai/openai.ts src/lib/whatsapp/ai/tools/definitions.js`
2. Comparer les deux définitions champ par champ (déjà identifié : `contact_phone` vs `customer_phone` en P0-5)
3. Une fois P0-5 corrigé dans `openai.ts`, ajouter un commentaire de synchronisation :
   ```typescript
   // ⚠️ Ces tools doivent rester synchronisés avec src/lib/whatsapp/ai/tools/definitions.js
   // Lors de toute modification ici, mettre à jour definitions.js en même temps
   ```
4. À terme (P3) : créer un fichier unique de définitions importé par les deux stacks
5. Committer : `docs: add sync warning between openai.ts tools and definitions.js`

---

### P1-23 — `generateAIResponse` sans retry (stack TS legacy)

**Problème confirmé :** `generator.js:181-200` a un retry avec backoff exponentiel. `openai.ts:generateAIResponse` (ligne 73) n'a aucun retry — simple `try/catch`.

**Note :** Cette fonction est utilisée par la stack TS legacy (via `message-handler.ts`). Après archivage de `message-handler.ts` (P1-13), ce point sera sans objet. **À traiter uniquement si P1-13 est bloqué ou retardé.**

**Procédure (si nécessaire) :**
1. `sed -n '73,130p' src/lib/ai/openai.ts` — lire la fonction complète
2. Ajouter le même pattern de retry que `generator.js:181`
3. Committer : `fix: add retry to generateAIResponse in openai.ts`

---

### P2-36 — BillingService

**Problème :** Logique billing dispersée dans `finalization.ts`, `cron.service.ts`, `plans.ts`, et routes admin.

**Procédure :**
1. Créer `src/lib/billing/billing.service.ts`
2. Migrer progressivement les fonctions : commencer par `planAgentLimits` (déjà fait en P1-17)
3. Ordre de migration : `getPlanLimits()` → `activateSubscription()` → `deductCredits()` → `freezeCredits()` → `rolloverCredits()`
4. **Ne pas casser les imports existants** : utiliser des re-exports depuis les anciens emplacements pendant la transition
5. Committer par fonction migrée

---

### P2-37a — Quickwin : `transitionToCartRecap()`

**PRIORITÉ ÉLEVÉE** (peut être fait maintenant, faible risque)

**Problème confirmé par grep :** Le bloc de 4-5 lignes apparaît à ces positions :
- Lignes 1212-1216, 1241-1245, 1298-1302, 1369-1373, 1432-1433, 1534-1538 → bloc complet avec `last_prompt_text`
- Ligne 1694-1697 → bloc **partiel** (sans `last_prompt_text` ni `last_prompt_kind`) — **à NE PAS remplacer**

**Procédure :**
1. Lire chaque occurrence pour confirmer qu'elle contient bien les 5 lignes :
   ```bash
   grep -n "draft_item = null" src/lib/whatsapp/services/cart-state.service.js
   ```
2. Ajouter la fonction en haut du fichier (après les constantes, avant les fonctions) :
   ```javascript
   function transitionToCartRecap(state, normalized) {
       state.draft_item = null
       state.stage = CART_STAGE.CART_RECAP
       state.awaiting_field = buildCartActionField()
       state.last_prompt_kind = CART_STAGE.CART_RECAP
       state.last_prompt_text = normalized
   }
   ```
3. Remplacer uniquement les 6 occurrences du **bloc complet** (lignes ~1212, 1241, 1298, 1369, 1432, 1534) par `transitionToCartRecap(state, normalized)`
4. **Ne pas remplacer** le bloc partiel de la ligne ~1694 (il ne contient pas `last_prompt_text`)
5. Tester : parcours commande complet (produit → variantes → recap → confirmation)
6. Committer : `refactor: extract transitionToCartRecap() to remove 6x duplication`

---

### P2-37b — Simplifier `parseBatchCombinationLines`

**Fichier :** `cart-state.service.js` lignes 437-570 (134 lignes, 6 statuts de retour)

**Statuts actuels :** `not_batch`, `invalid`, `error`, `success`, `missing_variant_sequential`, `missing_quantities`

**Procédure :**
1. Écrire les tests de comportement **avant** de modifier (inputs → outputs attendus)
2. Extraire chaque cas de retour dans une sous-fonction dédiée
3. Vérifier que tous les cas de retour sont gérés par les appelants
4. Committer : `refactor: split parseBatchCombinationLines into sub-functions`

---

### P2-45 — `getSupabase()` crée un nouveau client par appel dans le webhook

**Problème confirmé par lecture :** Dans `src/app/api/payments/cinetpay/webhook/route.ts`, `getSupabase()` est défini comme `() => createClient(...)` et appelé **14 fois** dans la même fonction POST. Chaque appel crée un nouveau client Supabase.

**Fichier :** `src/app/api/payments/cinetpay/webhook/route.ts`

**Procédure :**
1. `grep -n "getSupabase()" src/app/api/payments/cinetpay/webhook/route.ts`
2. Remplacer toutes les occurrences par un singleton en début de handler :
   ```typescript
   export async function POST(request: Request) {
       const supabase = getSupabase() // ← une seule fois
       // ... remplacer tous les getSupabase() par supabase
   }
   ```
3. Vérifier que toutes les 14 occurrences sont remplacées
4. Tester : passer un paiement complet
5. Committer : `perf: create single Supabase client per webhook request`

---

### P2-37c à P2-44 — Découpe complète des God Files

**RÈGLE ABSOLUE pour chaque découpe :**
1. Écrire la liste complète des fonctions exportées du fichier actuel
2. Créer le nouveau fichier avec les fonctions extraites
3. Dans l'ancien fichier : remplacer les fonctions par des imports + re-exports
4. Vérifier que tous les imports existants fonctionnent toujours
5. Tester le parcours complet avant de committer
6. Ne supprimer les re-exports qu'après avoir mis à jour tous les imports

**Ordre recommandé :**
1. `cart-state.service.js` → `cart-parser.js` + `cart-formatter.js` + `cart-state.js`
2. `checkout-state.service.js` → même pattern
3. `booking-state.service.js` → même pattern
4. `message.js` → pipeline en étapes séparées
5. `openai.ts` → client + prompt-builder + tools
6. `prompt-builder.js` → orchestrateur + sections
7. `ProductVariantsEditor.tsx` → sous-composants + hooks

---

## P3 — LONG TERME

> À planifier après stabilisation complète de P0 et P1

| # | Action | Prérequis |
|---|--------|-----------|
| 45 | Tests unitaires (finalization, webhook, cart-state, credits) | P2 découpe terminée |
| 46 | Migration progressive JS → TypeScript | P2 découpe terminée |
| 47 | Cache produits par agent (TTL 5 min) | Mesurer l'impact d'abord |
| 48 | BullMQ : découpler Baileys / OpenAI | Nécessite Redis en prod |
| 49 | Redis pour `activeSessions` multi-instances | Nécessite Redis en prod |

---

## SUIVI D'AVANCEMENT

### P0 — Bugs actifs

| # | Item | Statut | Date | Notes |
|---|------|--------|------|-------|
| P0-1 | `voice_enabled` → `enable_voice_responses` | ⬜ À faire | | |
| P0-2 | `/dashboard/messages` → `/dashboard/conversations` | ⬜ À faire | | |
| P0-3 | Masquer PII dans logs serveur ET Sentry (2 endroits) | ⬜ À faire | | |
| P0-4 | N+1 Supabase → `.in()` | ⬜ À faire | | |
| P0-5 | `contact_phone`/`customer_phone` tools IA | ⬜ À faire | | |
| P0-6 | Unifier admin-notify | ⬜ À faire | | |

### SQL — Déjà exécuté

| # | Item | Statut | Date |
|---|------|--------|------|
| SQL-1 | UNIQUE `orders.transaction_id` | ✅ Fait | 2026-03-21 |
| SQL-2 | Index composite `conversations(agent_id, contact_phone)` | ✅ Fait | 2026-03-21 |
| SQL-3 | Index `orders(customer_phone)` | ✅ Fait | 2026-03-21 |

### P1 — Dette urgente

| # | Item | Statut | Date | Notes |
|---|------|--------|------|-------|
| P1-7 | Race condition webhook (code) | ⬜ À faire | | DB sécurisée + guard partiel ligne 146 |
| P1-8 | Validation entrées IA | ⬜ À faire | | |
| P1-9 | Masquer IP logs | ⬜ À faire | | |
| P1-10 | OpenAI timeout 30s | ⬜ À faire | | |
| P1-11 | Fail-fast clé OpenAI | ⬜ À faire | | |
| P1-12 | `writeData()` sans retry (log existe déjà) | ⬜ À faire | | |
| P1-13 | Neutraliser stack legacy TS | ⬜ À faire | | Voir procédure 4 étapes |
| P1-14 | Supprimer fichiers pollution | ⬜ À faire | | |
| P1-15 | Centraliser devises `currency.ts` | ⬜ À faire | | |
| P1-16 | `profiles.currency` comme source devise | ⬜ À faire | | |
| P1-17 | Source unique `planAgentLimits` | ⬜ À faire | | |
| P1-18 | Typer `SupabaseClientLike` | ⬜ À faire | | |
| P1-19 | Mettre à jour `database.ts` | ⬜ À faire | | |
| P1-20 | Réduire `select('*')` agents (l.205) ET products (l.341) | ⬜ À faire | | |
| P1-21 | Validation Zod routes critiques | ⬜ À faire | | |
| P1-22 | Sync warning `openai.ts` tools ↔ `definitions.js` | ⬜ À faire | | Risque désynchronisation |
| P1-23 | Retry `generateAIResponse` (si P1-13 bloqué) | ⬜ Conditionnel | | Inutile si P1-13 fait |

### P2 — Qualité & performance

| # | Item | Statut |
|---|------|--------|
| P2-22 | ~~`Promise.all` sentiment + IA~~ | ❌ Supprimé — sentiment gate l'appel IA |
| P2-23 | `analyzeLeadQuality` background | ⬜ À faire |
| P2-24 | Middleware cookie profil | ⬜ À faire |
| P2-25 | RAG filtre 90 jours | ⬜ À faire |
| P2-26 | Monitoring tokens OpenAI | ⬜ À faire |
| P2-27 | `process.exit` flush 2s | ⬜ À faire |
| P2-28 | Épingler Baileys RC7 | ⬜ À faire |
| P2-29 | Guard `activeSessions` | ⬜ Vérifier — guard partiel existe déjà l.129 |
| P2-30 | `updateMetadata()` atomic RPC | ⬜ À faire |
| P2-31 | `normalizeText()` centralisé | ⬜ À faire |
| P2-32 | `isPositiveReply()` centralisé | ⬜ À faire |
| P2-33 | Pattern clone/get/set/clear | ⬜ À faire |
| P2-34 | `pricing-engine.js` | ⬜ À faire |
| P2-35 | `constants.js` magic numbers | ⬜ À faire |
| P2-36 | `BillingService` source unique | ⬜ À faire |
| P2-37a | `transitionToCartRecap()` quickwin | ⬜ À faire |
| P2-37b | `parseBatchCombinationLines` refacto | ⬜ À faire |
| P2-37c | Découpe `cart-state.service.js` | ⬜ À faire |
| P2-38 | Découpe `checkout-state.service.js` | ⬜ À faire |
| P2-39 | Découpe `booking-state.service.js` | ⬜ À faire |
| P2-40 | Découpe `message.js` | ⬜ À faire |
| P2-41 | Découpe `openai.ts` | ⬜ À faire |
| P2-42 | Découpe `prompt-builder.js` | ⬜ À faire |
| P2-43 | Découpe `ProductVariantsEditor.tsx` | ⬜ À faire |
| P2-44 | Découpe `handleCreateOrder` | ⬜ À faire |
| P2-45 | `getSupabase()` singleton dans webhook | ⬜ À faire |

### P3 — Long terme

| # | Item | Statut |
|---|------|--------|
| P3-45 | Tests unitaires | ⬜ Planifié |
| P3-46 | Migration JS → TypeScript | ⬜ Planifié |
| P3-47 | Cache produits par agent | ⬜ Planifié |
| P3-48 | BullMQ Baileys/OpenAI | ⬜ Planifié |
| P3-49 | Redis activeSessions | ⬜ Planifié |

---

*Document généré le 2026-03-21 — Mettre à jour le tableau de suivi à chaque item terminé*

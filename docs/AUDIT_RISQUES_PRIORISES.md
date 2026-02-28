# Audit Risques Priorises - WhatsAI / WazzapAI

Date: 2026-02-28  
Portee: backend API, paiements, credits, auth/RBAC, notifications, deploy  
Objectif: documenter les risques du plus eleve au plus faible, avec exemples concrets et correctifs proposes.

## Etat implementation (2026-02-28)

Statut global:
- Critique: corrige
- Eleve: corrige partiellement (pipeline de finalisation encore multiple, mais garde-fous ajoutes)
- Moyen: corrige majoritairement
- Faible: corrige

Correctifs implementes:
- `payments/verify` securise (auth obligatoire, ownership/admin, idempotence, credits via RPC `add_credits`)
- Notifications push durcies:
  - `claim-token` derive le user depuis session et claim uniquement le token courant
  - `register-device-native` ignore `userId` client et n'associe qu'avec session authentifiee
- Credits atomiques:
  - `ai/generate` => `rpc('deduct_credits')`
  - `playground/chat` => suppression du fallback non atomique
- `payments/cinetpay/status`:
  - auth + ownership/admin
  - correction RPC `p_amount` (plus `p_credits`)
  - verification d'erreurs RPC et idempotence
- `payments/webhook`:
  - garde idempotence (`status=completed`)
  - ajout credits via RPC atomique
- RBAC admin aligne: APIs admin acceptent `admin` et `superadmin`
- Contrat API: `successResponse()` renvoie maintenant `{ success: true, data }`
- Signature webhook: route CinetPay alignee sur la fonction partagee `verifyWebhookSignature`
- Rate-limit: fallback Redis en memoire (plus de fail-open)
- Scripts deploy/rollback/update: suppression des `git reset --hard` dans les scripts principaux modifies

## 1) Critique - Endpoint verification paiement expose sans auth + service role

### Risque
Un endpoint de verification paiement peut etre appele sans controle strict d'identite/ownership, tout en ayant acces service role.

### Impact
- Escalade de privilege
- Validation/crediting non autorise
- Risque de fraude

### Fichiers concernes
- `src/app/api/payments/verify/route.ts`

### Exemple concret
Un acteur appelle `POST /api/payments/verify` avec un `paymentId` non lie a son compte.  
Si la route finalise/credite sans verifier `payment.user_id === user.id`, il peut declencher une action sensible.

### Avant (pseudo-code)
```ts
POST /api/payments/verify
const admin = serviceRoleClient()
const payment = admin.from('payments').eq('id', paymentId).single()
checkProvider(payment.provider_transaction_id)
creditUser(payment.user_id)
```

### Apres (pseudo-code)
```ts
POST /api/payments/verify
const user = requireAuth()
const payment = admin.from('payments').eq('id', paymentId).single()
if (payment.user_id !== user.id && !isAdmin(user)) return 403
finalizePaymentIdempotent(payment.provider_transaction_id)
```

### Correctif recommande
- Auth obligatoire
- Controle ownership strict
- Endpoint "manual verify" reserve admin uniquement

---

## 2) Critique - APIs push autorisent association userId sans authentification

### Risque
Les routes push acceptent `userId` depuis le client sans verification de session.

### Impact
- Detournement de token push
- Mauvais routage des notifications
- Fuite d'information fonctionnelle

### Fichiers concernes
- `src/app/api/notifications/claim-token/route.ts`
- `src/app/api/notifications/register-device-native/route.ts`
- `src/app/api/notifications/register-device/route.ts`

### Exemple concret
Un client malveillant envoie `{"userId":"victime"}` sur `claim-token` et rattache des tokens non assignes a la victime.

### Avant (pseudo-code)
```ts
const { userId } = body
admin.update('device_tokens', { user_id: userId }).is('user_id', null)
```

### Apres (pseudo-code)
```ts
const user = requireAuth()
const { token } = body
admin.update('device_tokens', { user_id: user.id }).eq('token', token)
```

### Correctif recommande
- Auth obligatoire sur toutes routes de registration/claim
- Ignorer `userId` fourni par client
- Deriver user depuis session
- Claim cible par token courant, pas global "all null"

---

## 3) Eleve - Multiplication de flux paiements concurrents

### Risque
Plusieurs routes peuvent finaliser un paiement:
- `/api/payments/webhook`
- `/api/payments/cinetpay/webhook`
- `/api/payments/verify`
- `/api/payments/cinetpay/status`

### Impact
- Double credit
- Etats contradictoires
- Dette technique et maintenance fragile

### Exemple concret
Webhook A marque `completed`, puis `verify` repasse et recalcule credits.

### Avant (pseudo-code)
```ts
webhookA -> finalize + credit
webhookB -> finalize + credit
verify   -> finalize + credit
status   -> finalize + credit
```

### Apres (pseudo-code)
```ts
function finalizePayment(txId, source) { /* unique + idempotent */ }
webhook_unique -> finalizePayment(txId, 'webhook')
verify/status  -> read-only OR call finalizePayment with strict guard
```

### Correctif recommande
- Un seul pipeline de finalisation
- Idempotence stricte (transaction/provider unique)
- Deprecier routes legacy qui modifient l'etat

---

## 4) Eleve - Debit/credit non atomique dans certaines routes

### Risque
Certaines routes font "read then write" au lieu d'un RPC atomique.

### Impact
- Race conditions
- Solde incoherent
- Comptabilite credits fausse

### Fichiers concernes
- `src/app/api/ai/generate/route.ts`
- `src/app/api/playground/chat/route.ts`
- `src/app/api/payments/verify/route.ts`

### Exemple concret
Deux requetes lisent `credits_balance = 10` en meme temps, deduisent 1 chacune, solde final = 9 au lieu de 8.

### Avant (pseudo-code)
```ts
balance = select credits_balance
if (balance >= 1) update credits_balance = balance - 1
```

### Apres (pseudo-code)
```ts
newBalance = rpc('deduct_credits', { p_user_id, p_amount: 1 })
if (newBalance < 0) return insufficient_credits
```

### Correctif recommande
- Forcer `deduct_credits`/`add_credits` partout
- Supprimer toute ecriture directe read-then-write

---

## 5) Eleve - `cinetpay/status` incoherent avec RPC SQL + droits

### Risque
Le code appelle le RPC avec un parametre different de la signature SQL.

### Impact
- Credit non applique
- Echec silencieux possible
- Etat "OK" faux positif

### Fichiers concernes
- `src/app/api/payments/cinetpay/status/route.ts`
- `supabase/migrations/011_atomic_credits.sql`

### Exemple concret
Code appelle:
```ts
rpc('add_credits', { p_user_id, p_credits: n })
```
SQL attend:
```sql
add_credits(p_user_id uuid, p_amount int)
```

### Correctif recommande
- Aligner parametres RPC sur SQL (`p_amount`)
- Verifier erreurs RPC a chaque appel
- Executer avec client securise (service role cote serveur)

---

## 6) Moyen - Incoherence modele credits (`credits` vs `credits_balance`)

### Risque
Certaines routes admin manipulent `credits`, alors que le schema/runtime utilisent `credits_balance`.

### Impact
- Actions admin partiellement cassees
- UX trompeuse ("reset credits" sans effet reel)

### Fichiers concernes
- `src/app/api/admin/users/[id]/route.ts`
- `supabase/migrations/001_initial_schema.sql`

### Exemple concret
Admin clique "reset credits", code met `credits = 0`, runtime continue sur `credits_balance`.

### Correctif recommande
- Migrer tout vers `credits_balance`
- Supprimer toute reference `credits` dans `profiles`

---

## 7) Moyen - RBAC incoherent (middleware vs API vs schema role)

### Risque
Controle d'acces non uniforme:
- middleware accepte `superadmin`
- beaucoup d'API admin n'acceptent que `admin`
- certaines migrations anciennes contraignent `user/admin`

### Impact
- Acces divergents selon couche
- Cas limites difficiles a diagnostiquer

### Fichiers concernes
- `src/middleware.ts`
- `src/app/api/admin/*`
- `supabase/migrations/005_subscription_plans.sql`

### Exemple concret
Un `superadmin` passe middleware, mais se fait refuser certaines APIs admin.

### Correctif recommande
- Normaliser roles (`user/admin/superadmin`) DB + code
- Utilitaire unique `requireRole([...])` reutilise partout

---

## 8) Moyen - Contrat API non aligne cote UI admin

### Risque
UI attend `json.success`, API renvoie `{ data }`.

### Impact
- Composants admin qui ne s'affichent pas correctement (notifications/alerts)

### Fichiers concernes
- `src/app/[locale]/admin/layout.tsx`
- `src/lib/api-utils.ts`
- `src/app/api/admin/alerts/route.ts`

### Exemple concret
`if (json.success && json.data)` retourne faux car API renvoie uniquement `{ data: ... }`.

### Correctif recommande
- Uniformiser schema de reponse
- Ou adapter UI sur `json.data`

---

## 9) Moyen - Verification signature webhook implemente differemment

### Risque
Deux styles de verification coexistent (hex vs texte brut).

### Impact
- Faux negatifs/faux positifs
- Comportement non deterministe entre routes

### Fichiers concernes
- `src/app/api/payments/cinetpay/webhook/route.ts`
- `src/lib/payments/cinetpay.ts`

### Exemple concret
Webhook valide accepte dans une route, rejete dans une autre selon format compare.

### Correctif recommande
- Une seule fonction de verification signature
- Comparaison hex + controle longueur + timingSafeEqual

---

## 10) Faible - Rate limit en fail-open si Redis indisponible

### Risque
En cas d'erreur Redis, le limiteur autorise la requete.

### Impact
- Surface d'abus temporaire (surtout endpoints sensibles)

### Fichier concerne
- `src/lib/rate-limit.ts`

### Correctif recommande
- Fallback memoire pour endpoints sensibles
- Politique plus conservative si Redis down

---

## 11) Faible - Deploy avec `git reset --hard`

### Risque
Le script de deploy peut ecraser des hotfix locaux non commit.

### Impact
- Regression operationnelle
- Perte de correctifs urgents sur serveur

### Fichier concerne
- `deploy.sh`

### Correctif recommande
- Deploy immuable (tag/artifact)
- Refuser deploy si workspace serveur dirty
- Eviter `reset --hard` sur environnement prod

---

## Notes de coherence devise/pricing (contexte de ce projet)

Constat observe:
- Le profil utilisateur peut choisir `USD/EUR/XOF` (affichage UX)
- Les prix plans/packs actuels en base ressemblent a une base USD (ex: 10, 25, 100)
- Le backend paie en XOF (CinetPay), avec conversion

Point critique corrige:
- Uniformisation du taux backend a `700` sur le flux principal paiement pour eviter ecarts entre:
  - montant envoye au provider
  - montant stocke en `amount_fcfa`

Recommandation long terme:
- Documenter explicitement la monnaie de reference metier (USD base ou XOF base)
- Conserver une seule source de conversion backend
- Garder la devise profil pour presentation UX

---

## Checklist de remediation prioritaire (execution)

1. Verrouiller auth/ownership de `payments/verify`.
2. Securiser routes notifications (auth + claim cible).
3. Unifier finalisation paiement (single pipeline idempotent).
4. Forcer RPC atomiques credits partout.
5. Corriger incoherences schema code (`credits_balance`, roles).
6. Uniformiser contrats API response utilises par UI.
7. Unifier verification de signature webhook.
8. Durcir fallback rate-limit.
9. Fiabiliser procedure de deploy.

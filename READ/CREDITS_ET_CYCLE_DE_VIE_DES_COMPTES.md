# Crédits et cycle de vie des comptes — WazzapAI

> **Objectif de ce document :** Expliquer de façon narrative et exhaustive comment les crédits fonctionnent, comment ils sont attribués, et ce qui arrive à un compte selon qu'il paie ou non. Ce document fait référence au code et à la base de données.

---

## 1. Qu'est-ce qu'un crédit ?

1 crédit = 1 message envoyé par l'IA à un client WhatsApp.

Chaque fois qu'un agent WhatsApp répond à un message entrant, un crédit est débité du solde de l'utilisateur. Si le solde tombe à 0, l'IA se met en pause — l'agent reste connecté mais ne répond plus.

---

## 2. Attribution des crédits à l'inscription

### Ce qui se passe techniquement

Quand un utilisateur crée un compte, Supabase Auth déclenche automatiquement un trigger PostgreSQL (`handle_new_user`) qui crée un enregistrement dans la table `profiles`.

**Fichier :** `supabase/migrations/20260404_default_credits_10.sql`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, credits_balance, test_account_cleanup_deadline)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        10,                          -- crédits initiaux
        NOW() + INTERVAL '7 days'   -- deadline de suppression si pas de paiement
    );
    RETURN NEW;
END;
$$ language 'plpgsql' security definer;
```

### Ce que l'utilisateur reçoit

| Moment | Crédits | Source |
|--------|---------|--------|
| À l'inscription | **10 crédits** | Trigger Supabase (`20260404_default_credits_10.sql`) |
| Après souscription Starter | **+ 500 crédits** | `finalization.ts` → `plan.credits_included` |
| Après souscription Pro | **+ 2 500 crédits** | idem |
| Après souscription Business | **+ 8 000 crédits** | idem |
| Après souscription Scale | **+ 20 000 + rollover 20% + 2 000 bonus** | idem |
| Après achat pack Boost Mini | **+ 200 crédits** | `finalization.ts` → `resolveCreditsToAdd` |

> **Exemple concret :** Kofi s'inscrit le 1er avril. Il reçoit immédiatement 10 crédits. Il teste l'IA — chaque réponse consomme 1 crédit. Après 10 messages, l'IA s'arrête. Pour continuer, il doit payer.

---

## 3. Les types de comptes et leurs règles

### 3.1 Compte test (nouvel inscrit free sans paiement)

**Définition dans le code** (`src/lib/test-account.ts`) :

```typescript
isTestAccount = isFreePlan && !isProtectedRole && !hasCompletedPayments && !hasQualifiedHistory
```

Un compte est considéré "test" si :
- Plan = free
- Pas un rôle protégé (admin, etc.)
- Aucun paiement complété
- Jamais qualifié (`test_account_qualified_at` est null)

**Ce qui arrive :**
- À l'inscription → deadline posée à `J+7`
- Un compte à rebours est visible dans le dashboard
- À 22h30 UTC chaque soir → le cron vérifie les comptes expirés et supprime ceux dont la deadline est passée

> **Exemple :** Marie s'inscrit le 5 avril. Sa deadline est le 12 avril à l'heure exacte de son inscription. Si elle ne paie pas avant le 12 avril, son compte est définitivement supprimé le 12 avril à 22h30 UTC.

### 3.2 Compte protégé (a payé au moins une fois)

Dès qu'un paiement est validé (`status = 'completed'`), la fonction `markUserAsQualified` est appelée dans `finalization.ts` :

```typescript
await markUserAsQualified(adminSupabase, payment.user_id)
// → test_account_qualified_at = NOW()
// → test_account_cleanup_deadline = NULL
```

Le compte est **immunisé définitivement** contre la suppression automatique tant qu'il reste actif (abonnement non expiré).

> **Exemple :** Kofi achète le pack Boost Mini (200 crédits, 3 000 FCFA). Dès la confirmation du paiement, son compte à rebours disparaît. Son compte est protégé.

### 3.3 Compte acheteur de crédits (sans abonnement)

Un utilisateur qui achète uniquement des packs de crédits (sans souscrire à un abonnement mensuel) :
- Est protégé par `markUserAsQualified` dès le premier achat
- Reçoit une **validité d'1 mois** à chaque achat de crédits
- A accès à **1 agent** (limite du plan free)
- Ses crédits ne expirent pas, mais son compte a une deadline d'1 mois

> **Règle :** Chaque achat de crédits repart pour 1 mois. Si aucun achat pendant 1 mois → grace period 7 jours → compte supprimé.

> **Exemple :** Ama achète le Boost S (500 crédits) le 3 mars. Sa validité court jusqu'au 3 avril. Le 3 avril, elle n'a pas racheté de crédits. Sa deadline est posée au 10 avril. Elle reçoit un email + push le 7 avril (J+4 = 3 jours avant). Si elle n'agit pas avant le 10 avril → compte supprimé.

### 3.4 Abonné actif (plan payant en cours)

Un abonné a souscrit à Starter, Pro, Business ou Scale.

- Agents actifs selon le plan (1, 3, 6, ou ∞)
- Crédits rechargés chaque mois
- Pas de deadline de suppression tant que l'abonnement est actif

> **Exemple :** Kwame est abonné Pro. Il a 3 agents actifs, 2 500 crédits/mois. Ses crédits se rechargent le même jour chaque mois.

### 3.5 Abonné expiré (abonnement non renouvelé)

Quand l'abonnement expire et n'est pas renouvelé, le cron `checkExpiredSubscriptions` (8h00 UTC) déclenche :

1. Plan → `free`
2. Tous les agents → désactivés
3. Crédits restants → gelés (inaccessibles)
4. `test_account_cleanup_deadline` → `NOW() + 7 jours`

Le dashboard affiche immédiatement la bannière rouge :
> "Votre abonnement a expiré — compte supprimé le [DATE EXACTE]"

**Si renouvellement avant la deadline :**
- Crédits gelés → restaurés intégralement
- Agents → réactivés immédiatement
- Nouveaux crédits du plan → cumulés avec l'ancien solde
- Deadline → supprimée

**Si pas de renouvellement après 7 jours :**
- Compte définitivement supprimé (profil, agents, historique, tout)
- À J+4, un email + notification push sont envoyés en avertissement

> **Exemple :** Fatou est abonnée Business. Son abonnement expire le 15 mai. Elle n'a pas renouvelé. Le 15 mai à 8h00 UTC, ses 6 agents sont désactivés, ses 3 200 crédits restants sont gelés, et sa deadline est posée au 22 mai. Le 19 mai elle reçoit un email et un push. Elle renouvelle le 21 mai → ses 3 200 crédits sont restaurés + 8 000 nouveaux = 11 200 crédits, ses 6 agents sont réactivés.

---

## 4. Règle unique de suppression

**Tous les comptes non-payants suivent la même règle :**

| Type | Déclencheur de la deadline | Durée | Résultat |
|------|--------------------------|-------|----------|
| Nouvel inscrit free | Inscription | 7 jours | Compte supprimé |
| Acheteur crédits (inactif 1 mois) | Fin de validité 1 mois | 7 jours | Compte supprimé |
| Abonné expiré (non renouvelé) | Expiration abonnement | 7 jours | Compte supprimé |

La suppression est exécutée par le cron `handleTestAccountCleanup` à **22h30 UTC** chaque soir.

**Ce qui est supprimé :** l'entrée dans `auth.users` → suppression en cascade de `profiles`, agents, sessions WhatsApp, historique de commandes — tout.

---

## 5. Plan Scale — Comportement spécial

Le plan Scale a un mécanisme de rollover unique (`finalization.ts`, lignes 357-361) :

```javascript
if (plan.id === 'scale') {
    rolloverAmount = Math.floor(currentBalance * 0.20)  // 20% du solde conservé en bonus
    bonusAmount = 2000                                   // bonus fixe mensuel
    newCreditsBalance = currentBalance + rolloverAmount + plan.credits_included + bonusAmount
}
```

> **Exemple :** Yaw est abonné Scale. En fin de mois, il lui reste 5 000 crédits non utilisés. Au renouvellement : il conserve 5 000 + reçoit 20% de bonus (1 000) + 20 000 nouveaux + 2 000 bonus = **28 000 crédits** au total.

Pour les autres plans, les crédits non utilisés sont simplement conservés (gelés) et restaurés au renouvellement — ils ne disparaissent pas.

---

## 6. Alerte avant suppression

À **J+4** (3 jours avant la deadline de suppression) :
- Un **email** est envoyé à l'utilisateur
- Une **notification push** (Firebase) est envoyée si activée

Le message indique clairement la date exacte de suppression et le lien pour renouveler.

> **Note technique :** Cette logique d'alerte est planifiée dans le cron `cron.service.ts`. Elle est décrite dans le plan `FONCTIONNALITE/PLAN_EXPIRATION_ABONNEMENT_SUPPRESSION_COMPTE_2026-04-11.md`.

---

## 7. Sources de vérité dans le code

| Information | Fichier | Ligne |
|------------|---------|-------|
| Crédits initiaux (10) | `supabase/migrations/20260404_default_credits_10.sql` | L.12 |
| Définition compte test | `src/lib/test-account.ts` | `isTestAccount` |
| Qualification après paiement | `src/lib/payments/finalization.ts` | `markUserAsQualified` |
| Cron suppression (22h30 UTC) | `src/lib/notifications/cron.service.ts` | `handleTestAccountCleanup` |
| Cron expiration abonnements (8h00 UTC) | `src/lib/notifications/cron.service.ts` | `checkExpiredSubscriptions` |
| Valeurs des plans | `src/lib/plans.ts` | `PLANS` |
| Packs de crédits | `src/lib/plans.ts` | `CREDIT_PACKS` |
| Rollover Scale | `src/lib/payments/finalization.ts` | L.357-361 |
| Bannière dashboard | `src/components/dashboard/TestAccountCountdownBanner.tsx` | — |

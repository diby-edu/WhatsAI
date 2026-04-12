# PLAN — Expiration abonnement & suppression compte

**Date :** 2026-04-10
**Statut :** À implémenter

---

## Contexte & objectif

Actuellement, quand un abonnement expire, le compte est downgradé en free mais reste ouvert indéfiniment. Un compte sans crédits et sans agents actifs est un compte zombie inutile. L'objectif est d'appliquer une règle unique et cohérente : tout non-payant est supprimé après 7 jours, avec un message clair et des incitations fortes à renouveler.

---

## Règle unique pour tous les non-payants

| Situation | Déclencheur | Deadline | Résultat |
|-----------|-------------|----------|----------|
| Nouveau inscrit (plan free) | Inscription | J+7 | Suppression compte |
| Abonné dont l'abonnement expire | Date d'expiration | J+7 | Suppression compte |

> **Principe clé :** seul un paiement complété protège définitivement un compte.
> Un compte qui a payé une fois (`test_account_qualified_at` défini) ne peut plus jamais être supprimé par ce mécanisme.
> Un compte qui re-souscrit avant la deadline voit sa deadline annulée.

---

## Ce qui se passe à l'expiration de l'abonnement

Au moment où le cron `checkExpiredSubscriptions` détecte l'expiration (8h00 UTC) :

1. `plan` passe de `pro/starter/business/scale` → `free`
2. Tous les agents sont désactivés (aucun agent actif, QR codes invalidés)
3. Les crédits restants sont **gelés** (non supprimés immédiatement, inaccessibles)
4. `test_account_cleanup_deadline` est posé à `now + 7 jours`
5. `test_account_qualified_at` est **réinitialisé à null** pour que la deadline soit prise en compte

> Note : le re-abonnement avant la deadline repose les deux champs (`qualified_at` = now, `deadline` = null), crédits gelés restitués + crédits du nouveau plan ajoutés.

### À l'expiration de la deadline (cron 22h30 UTC)

- Le compte est **définitivement supprimé** (auth.users en cascade → profil, agents, commandes, sessions)
- Les crédits gelés sont perdus
- Irréversible

---

## Avantages du re-abonnement avant la deadline

Si l'utilisateur re-souscrit **avant** la date de suppression :

- Ses **crédits gelés** lui sont intégralement restitués
- Ses **N agents** sont réactivés immédiatement (connexions WhatsApp restaurées)
- Son **catalogue, historique de commandes et configuration** sont intacts
- Les crédits du nouveau plan sont **ajoutés** aux crédits gelés restitués

---

## Message affiché dans le dashboard

### Bandeau d'alerte (rouge/orange, permanent, en haut du dashboard)

```
⚠️ Votre abonnement a expiré — compte supprimé le [DATE EXACTE]
Tous vos agents sont désactivés. Vos données seront perdues définitivement.
```

- Affiché dès le premier jour de la deadline
- Non masquable
- La date est affichée en clair (ex : "14 avril 2026"), pas "dans X jours" seul

### Panneau développé (ou modal au premier login après expiration)

```
Il vous reste X jours pour agir.

Si vous renouvelez avant le [DATE EXACTE] :
  ✓ Vos [N] crédits non utilisés vous sont restitués
  ✓ Vos [N] agents sont réactivés immédiatement
  ✓ Votre catalogue, historique et configuration sont intacts
  ✓ Les crédits de votre nouveau plan s'ajoutent à vos crédits récupérés

Après le [DATE EXACTE], votre compte et toutes vos données sont
définitivement supprimés. Cette action est irréversible.

[Renouveler mon abonnement →]   ← bouton principal, bien mis en évidence
```

### Règles d'affichage

- La **date exacte** est toujours affichée (pas seulement le nombre de jours)
- Les chiffres sont **personnalisés** selon le compte réel (N crédits, N agents)
- Le mot **"irréversible"** apparaît une seule fois, clairement
- Le bouton de renouvellement est le **seul CTA** mis en avant
- Countdown en jours/heures dans le bandeau (devient rouge vif < 48h)

---

## Ce qui change techniquement

### Cron `checkExpiredSubscriptions` (déjà existant, 8h00 UTC)

Ajouter à la fin du traitement d'expiration :

```typescript
// Poser la deadline de suppression
await adminSupabase
  .from('profiles')
  .update({
    test_account_cleanup_deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    test_account_qualified_at: null,  // réinitialiser pour que le cron de suppression le prenne en compte
  })
  .eq('id', userId)
```

### Cron `handleTestAccountCleanup` (déjà existant, 22h30 UTC)

Aucune modification nécessaire — il supprime déjà tous les comptes dont la deadline est dépassée et `shouldDelete = true`.

### Logique re-abonnement (finalization.ts)

Au moment où un paiement est complété :
1. `markUserAsQualified` est appelé → `qualified_at` = now, `deadline` = null ✓ (déjà implémenté)
2. Ajouter : restitution des crédits gelés au solde actif

### Frontend dashboard

- Lire `test_account_cleanup_deadline` depuis le profil
- Afficher le bandeau si deadline présente et compte non qualifié
- Afficher le nombre de crédits gelés (champ à ajouter : `credits_frozen`)
- Afficher le nombre d'agents désactivés

---

## Champs DB à ajouter/modifier

| Champ | Table | Type | Usage |
|-------|-------|------|-------|
| `credits_frozen` | `profiles` | `integer` | Crédits gelés au moment de l'expiration |

> Les champs `test_account_cleanup_deadline` et `test_account_qualified_at` existent déjà.

---

## Ordre d'implémentation recommandé

1. Ajouter colonne `credits_frozen` dans `profiles` (migration Supabase)
2. Modifier `checkExpiredSubscriptions` : poser deadline + geler crédits
3. Modifier `finalization.ts` : restituer crédits gelés au re-abonnement
4. Frontend dashboard : bandeau d'alerte + panneau détaillé + countdown
5. Tests end-to-end du parcours complet

---

## Parcours utilisateur complet (Kofi, plan Pro, 3 agents)

```
J0   — Abonnement Pro expire
       → plan = free, agents désactivés, crédits gelés (ex: 1 800 crédits)
       → deadline = J+7 (17 avril 2026)
       → Dashboard : bandeau rouge + modal explicatif

J1-6 — Kofi voit le countdown chaque fois qu'il se connecte
       → Bandeau permanent, compte à rebours visible

J5   — Kofi re-souscrit Pro
       → Paiement complété → markUserAsQualified
       → deadline = null, qualified_at = now
       → Crédits : 1 800 (gelés restitués) + 2 500 (nouveau plan) = 4 300 crédits
       → 3 agents réactivés immédiatement
       → Bandeau disparaît

--- OU ---

J7   — Kofi n'a pas renouvelé
       → Cron 22h30 : shouldDelete = true → deleteUser
       → Compte, agents, commandes, sessions → supprimés définitivement
```

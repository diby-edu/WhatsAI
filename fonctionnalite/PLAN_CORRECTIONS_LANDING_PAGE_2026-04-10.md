# PLAN — Corrections landing page & cohérence globale

**Date :** 2026-04-10
**Statut :** À implémenter
**Priorité :** Haute — informations incorrectes en production

---

## Décisions validées

| Question | Réponse |
|----------|---------|
| Crédits plan Free | **10 crédits** (plans.ts à corriger aussi) |
| Stat messages | **100K+** (Hero + Features) |
| Rating | **4.9/5** partout (Hero badge + Schema.org) |

---

## SOURCE DE VÉRITÉ APRÈS CORRECTIONS

| Plan | Crédits/mois | Agents | Prix FCFA |
|------|-------------|--------|-----------|
| Free | 10 | 1 | 0 |
| Starter | 500 | 1 | 6 900 |
| Pro | 2 500 | 3 | 19 900 |
| Business | 8 000 | 6 | 54 900 |
| Scale | 20 000 | ∞ | 129 900 |

> Note : "Numéros WhatsApp" = même chose qu'Agents. Colonne supprimée partout.

---

## 1. plans.ts

**Fichier :** `src/lib/plans.ts`

### Correction

```typescript
// AVANT
free: {
    credits: 50,  // ← FAUX
    ...
}

// APRÈS
free: {
    credits: 10,  // ← CORRECT
    ...
}
```

---

## 2. PRICING — fr.json

**Fichier :** `messages/fr.json`

### Corrections ligne par ligne

#### Plan Free (lignes ~276-278)

```json
// AVANT
"50 crédits offerts",
"1 agent IA",
"1 numéro WhatsApp",    ← SUPPRIMER

// APRÈS
"10 crédits offerts",
"1 agent IA",
```

#### Plan Starter (lignes ~286-288)

```json
// AVANT
"500 crédits/mois",
"2 agents IA",          ← FAUX
"1 numéro WhatsApp",    ← SUPPRIMER

// APRÈS
"500 crédits/mois",
"1 agent IA",
```

#### Plan Pro (lignes ~297-299)

```json
// AVANT
"2000 crédits/mois",    ← FAUX
"5 agents IA",          ← FAUX
"3 numéros WhatsApp",   ← SUPPRIMER

// APRÈS
"2 500 crédits/mois",
"3 agents IA",
```

#### Plan Business (lignes ~309-311)

```json
// AVANT
"10000 crédits/mois",   ← FAUX
"Agents illimités",     ← FAUX
"10 numéros WhatsApp",  ← SUPPRIMER

// APRÈS
"8 000 crédits/mois",
"6 agents IA",
```

---

## 3. PRICING — Pricing.tsx (fallback data)

**Fichier :** `src/components/landing/Pricing.tsx`

### Corrections lignes 88-92

```typescript
// AVANT
{ id: 'free',     ..., credits: 50,    max_agents: 1,  max_whatsapp_numbers: 1,  ... },
{ id: 'starter',  ..., credits: 500,   max_agents: 1,  max_whatsapp_numbers: 1,  ... },
{ id: 'pro',      ..., credits: 2500,  max_agents: 3,  max_whatsapp_numbers: 3,  ... },
{ id: 'business', ..., credits: 8000,  max_agents: 6,  max_whatsapp_numbers: 6,  ... },
{ id: 'scale',    ..., credits: 20000, max_agents: -1, max_whatsapp_numbers: -1, ... },

// APRÈS (supprimer max_whatsapp_numbers, corriger Free credits)
{ id: 'free',     ..., credits: 10,    max_agents: 1,  ... },
{ id: 'starter',  ..., credits: 500,   max_agents: 1,  ... },
{ id: 'pro',      ..., credits: 2500,  max_agents: 3,  ... },
{ id: 'business', ..., credits: 8000,  max_agents: 6,  ... },
{ id: 'scale',    ..., credits: 20000, max_agents: -1, ... },
```

### Supprimer l'affichage "Numéros WhatsApp" dans le rendu

Ligne 458 — supprimer le bloc qui affiche `plan.max_whatsapp_numbers`.

---

## 4. STATISTIQUES — Hero.tsx + Features.tsx + Schema.org

### Hero.tsx — stats (lignes ~291-313)

```tsx
// AVANT
{ value: "10K+", label: "Messages/mois" }   ← FAUX
{ value: "98%",  label: "Satisfaction" }    ← garder ou vérifier

// APRÈS
{ value: "100K+", label: "Messages/mois" }
```

### Features.tsx — stats (lignes ~203-226)

```tsx
// AVANT
{ value: "10M+", label: "Messages traités" }  ← FAUX et contradictoire avec Hero

// APRÈS
{ value: "100K+", label: "Messages traités" }
```

### page.tsx — Schema.org (lignes ~87-114)

```json
// AVANT
"aggregateRating": {
    "ratingValue": "4.8",   ← FAUX
    "ratingCount": "124"
}

// APRÈS
"aggregateRating": {
    "ratingValue": "4.9",
    "ratingCount": "124"
}
```

### Hero.tsx — floating rating badge

```tsx
// AVANT
"4.9/5"  ← déjà correct, garder
```

---

## 5. COPYRIGHT — Footer.tsx

**Fichier :** `src/components/landing/Footer.tsx`

```tsx
// AVANT
© 2025 WazzapAI. Tous droits réservés.

// APRÈS
© 2026 WazzapAI. Tous droits réservés.
```

---

## 6. FAQ — fr.json

**Fichier :** `messages/fr.json` (lignes ~319-378)

### Q3 — Essai gratuit (corriger crédits)

```json
// AVANT
"answer": "Absolument ! Créez un compte et recevez 50 crédits gratuits..."

// APRÈS
"answer": "Absolument ! Créez un compte et recevez 10 crédits gratuits pour tester la plateforme. Aucune carte de crédit requise. Passez à un plan payant quand vous êtes prêt."
```

### Q4 — Système de crédits (ajouter cas acheteurs crédits)

```json
// AVANT
"answer": "1 crédit = 1 message envoyé par l'IA. À l'expiration de votre forfait, vos crédits restants sont gelés et protégés pendant 7 jours. Si vous renouvelez dans ce délai, ils sont restaurés et cumulés avec les nouveaux crédits. Passé 7 jours sans renouvellement, ils sont définitivement supprimés."

// APRÈS
"answer": "1 crédit = 1 message envoyé par l'IA. Pour les abonnés : à l'expiration de votre forfait, vos crédits sont gelés pendant 7 jours. Si vous renouvelez dans ce délai, ils sont restaurés et cumulés avec les nouveaux crédits. Pour les achats de crédits sans abonnement : chaque achat donne une validité d'1 mois. Tout nouvel achat avant l'échéance prolonge cette validité d'1 mois supplémentaire. Passé 7 jours sans renouvellement dans les deux cas, votre compte est définitivement supprimé."
```

### Q5 — Plusieurs numéros WhatsApp (renommer + reformuler)

```json
// AVANT
"question": "Puis-je utiliser plusieurs numéros WhatsApp ?",
"answer": "Oui ! Le nombre de numéros dépend de votre forfait. Starter : 1, Pro : 3, Business : 6, Scale : illimité. Chaque numéro peut avoir son propre agent IA avec des instructions différentes."

// APRÈS
"question": "Puis-je connecter plusieurs agents WhatsApp ?",
"answer": "Oui ! Le nombre d'agents dépend de votre forfait. Starter : 1, Pro : 3, Business : 6, Scale : illimité. Chaque agent a son propre numéro WhatsApp, ses propres instructions et son propre catalogue."
```

### Q6 — Google Calendar (remplacer entièrement)

```json
// AVANT
"question": "L'IA peut-elle prendre des rendez-vous ?",
"answer": "Oui, avec Google Calendar sur Pro et Business."

// APRÈS
"question": "Comment connecter mon numéro WhatsApp à un agent ?",
"answer": "Depuis la page de votre agent dans le dashboard, cliquez sur Connecter WhatsApp. Deux options s'offrent à vous :\n\n• Scanner le QR code : ouvrez WhatsApp sur un autre appareil, allez dans Appareils liés et scannez.\n\n• Code de liaison : si vous êtes sur le même téléphone, choisissez cette option, entrez votre numéro et un code à 8 caractères s'affiche. Dans WhatsApp : Paramètres → Appareils liés → Lier un appareil → Lier avec un numéro de téléphone → saisir le code.\n\nL'agent est opérationnel dès la connexion établie."
```

### Q8 — Annulation (mettre à jour)

```json
// AVANT
"answer": "Oui, sans engagement ! Annulez votre abonnement à tout moment depuis votre tableau de bord. À l'expiration, vos crédits sont gelés et vos agents désactivés pendant 7 jours. Renouvelez dans ce délai pour tout récupérer."

// APRÈS
"answer": "Oui, sans engagement ! Annulez votre abonnement à tout moment depuis votre tableau de bord. À l'expiration, vos agents sont désactivés et vos crédits sont gelés pendant 7 jours. Si vous renouvelez dans ce délai, vos crédits gelés sont restitués et cumulés avec les crédits du nouveau plan, et vos agents sont réactivés immédiatement."
```

### Q nouvelle — Abonné expiré (insérer entre Q8 et Q9)

```json
{
  "expiredSubscription": {
    "question": "Que se passe-t-il quand mon abonnement payant expire ?",
    "answer": "Dès l'expiration : tous vos agents sont désactivés et vos crédits non utilisés sont gelés. Vous avez 7 jours pour renouveler.\n\nSi vous renouvelez avant la date limite :\n• Vos crédits gelés vous sont intégralement restitués\n• Ils s'ajoutent aux crédits de votre nouveau plan\n• Vos agents sont réactivés immédiatement\n\nSans renouvellement au bout de 7 jours, votre compte et toutes vos données (agents, historique, catalogue) sont définitivement supprimés. Cette action est irréversible."
  }
}
```

### Q9 — Après 7 jours (corriger)

```json
// AVANT
"answer": "Après 7 jours sans abonnement actif, vos crédits gelés sont définitivement supprimés et vos agents désactivés sont effacés. Une alerte vous est envoyée à J+4 (3 jours avant) pour vous laisser le temps de réagir."

// APRÈS
"answer": "Après 7 jours sans paiement valide, votre compte est définitivement supprimé : profil, agents, catalogue, historique de commandes — tout est effacé. Cette action est irréversible.\n\nUne alerte est envoyée par email et notification push à J+4 (3 jours avant la suppression) pour vous laisser le temps de réagir."
```

### Q nouvelle — Acheteur crédits sans abonnement (ajouter en fin de FAQ)

```json
{
  "creditsOnly": {
    "question": "Puis-je utiliser WazzapAI sans souscrire à un abonnement ?",
    "answer": "Oui. Vous pouvez acheter des crédits directement sans abonnement mensuel. Chaque achat vous donne accès à 1 agent WhatsApp pendant 1 mois. Chaque nouvel achat de crédits avant l'échéance prolonge cette validité d'1 mois supplémentaire. Vos crédits ne périment pas tant que votre compte est actif.\n\nExemple : vous achetez un pack le 10 avril → valide jusqu'au 10 mai. Vous rachetez le 1er mai → valide jusqu'au 1er juin.\n\nSi vous ne renouvelez pas avant l'échéance, vos crédits sont gelés 7 jours puis votre compte est définitivement supprimé."
  }
}
```

---

## 7. BANNIÈRE ONBOARDING — page.tsx

**Fichier :** `src/app/[locale]/onboarding/page.tsx`
**Ligne :** 184-187

```tsx
// AVANT
"Information importante : les comptes gratuits sans paiement valide et sans agent WhatsApp
completement connecte peuvent etre supprimes automatiquement apres 7 jours. Si votre compte
est encore considere comme compte test, un compte a rebours apparaitra dans votre dashboard."

// APRÈS
"Information importante : votre compte est en période d'essai de 7 jours. Sans souscription
à un abonnement ou achat de crédits avant la date limite, votre compte sera définitivement
supprimé. Un compte à rebours est affiché dans votre dashboard."
```

---

## 8. BANNIÈRE COUNTDOWN — TestAccountCountdownBanner.tsx

**Fichier :** `src/components/dashboard/TestAccountCountdownBanner.tsx`

### État 1 — Bienvenue (emphasizeWelcome = true, isExpired = false)

```tsx
// Titre — ligne 62
// AVANT : "Bienvenue - votre compte test dispose de 7 jours"
// APRÈS  : "Bienvenue — votre compte expire le [DATE EXACTE]"

// Description — ligne 67
// AVANT : `Sans paiement valide ni connexion complete d'un agent WhatsApp,
//          ce compte gratuit pourra etre supprime automatiquement dans ${graceDays} jours.`
// APRÈS  : `Sans paiement valide, ce compte et toutes vos données seront définitivement
//           supprimés le [DATE EXACTE]. Souscrivez avant cette date pour conserver votre compte.`
```

### État 2 — Countdown en cours (emphasizeWelcome = false, isExpired = false)

```tsx
// Titre — ligne 63
// AVANT : "Compte de test en attente de validation"
// APRÈS  : "Compte en période d'essai — suppression le [DATE EXACTE]"

// Description — même correction qu'État 1
```

### État 3 — Expiré (isExpired = true)

```tsx
// Titre — ligne 60
// AVANT : "Compte de test arrive a echeance"
// APRÈS  : "Compte expiré — suppression imminente"

// Description — ligne 66
// AVANT : "Votre delai de grace est termine. Effectuez un paiement valide ou connectez
//          un agent WhatsApp complet pour sortir immediatement du statut test."
// APRÈS  : "Votre délai d'essai est écoulé. Ce compte sera supprimé très prochainement.
//           Souscrivez immédiatement pour récupérer vos données."
```

### Ligne commune 137 — tous états

```tsx
// AVANT : "Pour conserver votre espace, validez un paiement ou connectez un agent WhatsApp complet."
// APRÈS  : "Souscrivez à un abonnement ou achetez des crédits pour conserver votre compte et vos données."
```

### Nouvel état — Abonné expiré (nouveau prop `isExpiredSubscriber`)

```tsx
// Ajouter dans les props :
type TestAccountBannerProps = {
    ...
    isExpiredSubscriber?: boolean  // ← NOUVEAU
    frozenCredits?: number         // ← NOUVEAU — crédits gelés à afficher
    agentsCount?: number           // ← NOUVEAU — agents désactivés à afficher
}

// Titre :
"Votre abonnement a expiré — compte supprimé le [DATE EXACTE]"

// Description :
"Tous vos agents sont désactivés et vos [N] crédits sont gelés.
Renouvelez avant le [DATE EXACTE] pour récupérer vos crédits et réactiver vos agents immédiatement.
Sans renouvellement, votre compte et toutes vos données sont définitivement supprimés."

// Ligne d'action :
"Renouvelez votre abonnement pour récupérer vos [N] crédits et réactiver vos [N] agents."
```

---

## 9. Exemple parcours utilisateur complet (validation visuelle)

### Nouveau inscrit (free)

```
J0   — Inscription → dashboard affiche :
       Titre : "Bienvenue — votre compte expire le 17 avril 2026"
       Description : "Sans paiement valide, ce compte sera définitivement supprimé le 17 avril 2026."
       Countdown : 07j 00h 00m 00s
       CTA : "Souscrivez à un abonnement ou achetez des crédits"

J4   — Email + push : "Votre compte sera supprimé dans 3 jours (le 17 avril)"

J7   — Cron 22h30 → compte supprimé
```

### Abonné Pro expiré

```
J0   — Expiration → dashboard affiche :
       Titre : "Votre abonnement a expiré — compte supprimé le 17 avril 2026"
       Description : "3 agents désactivés, 1 800 crédits gelés."
       CTA : "Renouvelez pour récupérer vos 1 800 crédits et réactiver vos 3 agents"
       Countdown : 07j 00h 00m 00s

J3   — Kofi re-souscrit Pro
       → 1 800 crédits gelés restitués + 2 500 crédits Pro = 4 300 crédits
       → 3 agents réactivés immédiatement
       → Bandeau disparaît

--- OU ---

J4   — Email + push : "Votre compte sera supprimé dans 3 jours"
J7   — Cron 22h30 → compte supprimé définitivement
```

### Acheteur crédits uniquement

```
10 avril  — Achète Boost M (2 000 crédits) → valide jusqu'au 10 mai
             Dashboard : "1 agent actif · 2 000 crédits · valide jusqu'au 10 mai"

1er mai   — Rachète Boost S (500 crédits) → valide jusqu'au 1er juin
             Nouveau solde : 2 000 + 500 = 2 500 crédits (cumulés)

1er juin  — Pas de renouvellement → crédits gelés + deadline J+7 (8 juin)
             Dashboard : bandeau rouge "Compte supprimé le 8 juin"

4 juin    — Email + push : "Votre compte sera supprimé dans 3 jours"

8 juin    — Cron 22h30 → suppression définitive
```

---

## 10. Ordre d'implémentation recommandé

1. `plans.ts` — corriger crédits Free (10)
2. `messages/fr.json` — pricing features (agents, crédits, supprimer numéros)
3. `messages/fr.json` — FAQ (Q3, Q4, Q5, Q6, Q8, Q9, nouvelles Q)
4. `Pricing.tsx` — fallback data + supprimer colonne numéros
5. `Hero.tsx` — stat messages (100K+)
6. `Features.tsx` — stat messages (100K+)
7. `page.tsx` Schema.org — rating 4.9
8. `Footer.tsx` — copyright 2026
9. `onboarding/page.tsx` — bannière onboarding
10. `TestAccountCountdownBanner.tsx` — 3 états + nouvel état abonné expiré

> Les logiques backend (validité crédits 1 mois, deadline abonné expiré, alerte J+4)
> font l'objet de plans séparés et ne sont pas incluses ici.

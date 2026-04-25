# Regle officielle - cycle de vie comptes test, credits et abonnements

**Date initiale :** 2026-04-17
**Mise a jour :** 2026-04-25 — Patch 5 : credits = carburant uniquement
**Statut :** Valide produit - base implementee en production
**Objectif :** definir une logique unique, explicite et non ambigue pour les comptes test, les comptes payants, les achats de credits, les expirations, le gel, le delai de grace et la suppression differee.

---

## CHANGEMENT MAJEUR DU PATCH 5 (2026-04-25)

**Avant (Patch 4) :** un achat de credits ouvrait une periode payante (`paid_until`), meme sans abonnement.
**Apres (Patch 5) :** les credits sont du carburant. Seul un abonnement ouvre `paid_until` et sort du statut test.

Implications :
- Un compte test qui achete des credits **reste un compte test**
- Les credits achetes sans abonnement **ne sont pas utilisables** tant qu'aucun abonnement n'est actif
- A l'expiration du test, si des credits ont ete achetes : **grace 30 jours** pour souscrire
- Les packs credits sont toujours plus chers au credit unitaire qu'un abonnement equivalent

---

## 1. Principe general

Il existe deux grandes familles de comptes :

1. **Compte test** — aucun abonnement complete
2. **Compte abonne actif** — au moins un abonnement complete

Un compte reste en statut test tant qu'aucun **abonnement** n'a ete finalise.
Un achat de credits seul ne sort **pas** du statut test.

---

## 2. Role des credits

Les credits sont du **carburant**, pas une cle d'acces.

- 1 credit = 1 message envoye par l'IA
- Les credits s'ajoutent au solde existant
- Ils sont **inutilisables sans abonnement actif**
- Un achat de credits ne modifie pas `paid_until`, `grace_until`, ni `account_lifecycle_status`
- Un achat de credits ne reactive pas les agents
- Un achat de credits ne sort pas du statut test

---

## 3. Regles centrales

### 3.1 Compte test sans aucun paiement

- delai test : **7 jours**
- si aucun abonnement pendant ce delai : **suppression**

### 3.2 Compte test avec credits achetes (sans abonnement)

- le compte **reste en statut test**
- les credits sont credites au solde mais **geles** (inutilisables)
- a l'expiration du delai test : **grace 30 jours** accordee automatiquement
- pendant la grace : agents archives, credits toujours geles
- si un abonnement est souscrit avant la fin de la grace : compte active, credits recuperes
- si aucun abonnement avant la fin de la grace : suppression

### 3.3 Compte test qui souscrit un abonnement

- sortie immediate du statut test
- `paid_until` ouvert selon l'abonnement
- `account_lifecycle_status = paid_active`
- agents reactives selon les limites du plan
- credits precedemment achetes (s'il y en a) deviennent utilisables

### 3.4 Fin de periode payante

Quand `paid_until` est depasse :

- `account_lifecycle_status = frozen_grace`
- les agents sont desactives
- les credits restants sont geles
- un delai de grace de **30 jours** commence : `grace_until`

### 3.5 Fin du delai de grace

Si aucun nouveau paiement avant `grace_until` :

- suppression differee du compte
- suppression des agents, donnees et dependances associees

---

## 4. Dates de reference

- `test_account_cleanup_deadline` : fin du test gratuit (7 jours)
- `paid_until` : fin de la periode d'abonnement active
- `grace_until` : fin du delai de grace apres expiration

Etats possibles de `account_lifecycle_status` :

- `test` : compte en periode d'essai
- `paid_active` : abonnement actif
- `frozen_grace` : expire, en grace (gel)
- `inactive` : grace ecoulee, supprimable

---

## 5. Durees retenues

### 5.1 Compte test

- duree : **7 jours**
- grace avec credits achetes : **30 jours supplementaires**

### 5.2 Abonnement mensuel

- ouvre une periode payante de **1 mois**

### 5.3 Abonnement annuel

- ouvre une periode payante de **1 an**

### 5.4 Achat de credits

- **n'ouvre pas de periode payante**
- ajoute uniquement au solde de credits

### 5.5 Delai de grace apres expiration abonnement

- duree : **30 jours**

---

## 6. Scenarios detailles

### 6.1 Nouveau compte test - aucun paiement

- creation : **14/07/2026**
- fin du test : **21/07/2026**
- aucun paiement → **suppression apres le 21/07**

### 6.2 Compte test qui achete des credits (sans abonnement)

- creation : **14/07/2026**
- achat de credits : **16/07/2026**
- credits credites au solde, geles (inutilisables)
- compte reste en statut test
- fin du test : **21/07/2026**
- aucun abonnement → grace automatique : `grace_until = 20/08/2026`
- agents archives pendant la grace
- si abonnement souscrit avant le 20/08 : credits recuperes + agents reactives
- si aucun abonnement : suppression apres le **20/08/2026**

### 6.3 Compte test qui souscrit un abonnement mensuel

- creation : **14/07/2026**
- abonnement mensuel : **18/07/2026**
- sortie immediate du test
- `paid_until = 18/08/2026`
- `account_lifecycle_status = paid_active`

### 6.4 Compte test qui souscrit un abonnement annuel

- creation : **14/07/2026**
- abonnement annuel : **18/07/2026**
- `paid_until = 18/07/2027`

### 6.5 Meme plan renouvele pendant la periode active

- plan actuel : **Pro mensuel**
- echeance actuelle : **14/08/2026**
- renouvellement le **20/07/2026**
- nouvelle echeance : **14/09/2026** (prolongation depuis la fin actuelle)

### 6.6 Changement de plan pendant la periode active

- plan actuel : **Starter mensuel** jusqu'au **14/08/2026**
- upgrade Pro mensuel le **13/08/2026**
- nouvelle echeance : **13/09/2026** (nouvelle periode complete depuis le paiement)

### 6.7 Achat de credits pendant une periode d'abonnement active

- abonnement actif jusqu'au **14/08/2026**
- achat de credits le **18/07/2026**
- credits ajoutes immediatement, utilisables
- `paid_until` reste **14/08/2026** (inchange)

### 6.8 Achat de credits sans abonnement actif (compte en grace ou expire)

- ancienne echeance : **14/08/2026**
- achat de credits le **25/08/2026** (pendant grace)
- credits credites au solde mais toujours geles
- **aucune nouvelle periode payante ouverte**
- pour utiliser les credits : souscrire un abonnement

### 6.9 Expiration abonnement sans renouvellement

- `paid_until = 14/08/2026`
- aucun paiement le 15/08
- compte gele : `grace_until = 13/09/2026`
- agents desactives, credits geles

### 6.10 Abonnement souscrit pendant la grace

- `grace_until = 13/09/2026`
- abonnement mensuel le **05/09/2026**
- compte restaure, agents reactives, credits geles restitues
- `paid_until = 05/10/2026`

### 6.11 Achat credits souscrit pendant la grace

- `grace_until = 13/09/2026`
- achat de credits le **05/09/2026**
- credits credites au solde
- **compte toujours gele** (achat credits ne restaure pas)
- pour restaurer : souscrire un abonnement

### 6.12 Grace ecoulee sans paiement

- `grace_until = 13/09/2026`
- aucun paiement le 14/09
- suppression du compte, agents, donnees

---

## 7. Ce qui doit arriver aux agents

| Etat | Comportement agents |
|---|---|
| Test actif | 1 agent autorise |
| Abonnement actif | Limite du plan |
| Expiration / Grace | Desactives, archives |
| Paiement abonnement pendant grace | Reactives immediatement |
| Achat credits pendant grace | Agents restent archives |
| Suppression finale | Supprimes avec le compte |

---

## 8. Ce qui doit arriver aux credits

| Etat | Comportement credits |
|---|---|
| Sans abonnement | Geles (inutilisables) |
| Abonnement actif | Utilisables normalement |
| Expiration | Geles |
| Paiement abonnement pendant grace | Geles restitues + credits du nouveau plan |
| Achat credits pendant grace | Credites au solde, toujours geles |
| Grace ecoulee | Perdus |

---

## 9. Regles de produit a ne pas melanger

### Regle A - Renouvellement du meme plan actif

- on prolonge depuis la fin de l'echeance actuelle

### Regle B - Changement de plan

- on repart de la date du paiement

### Regle C - Credits pendant abonnement actif

- credits ajoutes, echeance inchangee, utilisables immediatement

### Regle D - Credits sans abonnement actif

- credits credites mais geles
- aucune periode payante ouverte
- un abonnement est necessaire pour les utiliser

---

## 10. Cas pratiques ultra courts

### Cas 1
- test cree le **14/07**, aucun paiement → suppression apres **21/07**

### Cas 2
- test cree le **14/07**, credits achetes le **16/07** → credits geles, test toujours actif, grace 30j a l'expiration

### Cas 3
- test cree le **14/07**, abonnement le **18/07** → `paid_until = 18/08`, statut test retire

### Cas 4
- Pro actif jusqu'au **14/08**, renouvellement Pro le **20/07** → `paid_until = 14/09`

### Cas 5
- Starter actif jusqu'au **14/08**, upgrade Pro le **13/08** → `paid_until = 13/09`

### Cas 6
- abonnement actif jusqu'au **14/08**, achat credits le **18/07** → credits ajoutes, `paid_until` reste **14/08**

### Cas 7
- abonnement expire le **14/08**, grace jusqu'au **13/09**, abonnement le **05/09** → `paid_until = 05/10`, agents reactives

### Cas 8
- abonnement expire le **14/08**, grace jusqu'au **13/09**, aucun paiement → suppression apres **13/09**

### Cas 9
- abonnement expire le **14/08**, grace jusqu'au **13/09**, achat credits le **25/08** → credits credites, compte toujours gele, pas de restauration

---

## 11. Tarification des packs credits

Les packs credits sont systematiquement plus chers par credit que l'abonnement equivalent pour encourager la souscription :

| Pack | Credits | Prix FCFA | Credit/FCFA |
|---|---|---|---|
| Boost Mini | 200 | 3 000 | 0.067 |
| Boost S | 400 | 7 000 | 0.057 |
| Boost M | 1 800 | 25 000 | 0.072 |
| Boost L | 4 500 | 55 000 | 0.082 |
| Boost XL | 11 000 | 110 000 | 0.100 |

L'abonnement Pro (2 500 credits / 19 900 FCFA) donne 0.126 credit/FCFA — toujours plus avantageux.

---

## 12. Les 7 etats du compte — description narrative complete

Cette section decrit chaque etat possible d'un compte avec un exemple concret, ce que l'utilisateur voit dans le dashboard, ce qu'il peut faire, et ce qui se passe s'il ne fait rien.

---

### Etat 1 — Compte test actif, aucun paiement

**Qui est concerne :** Tout utilisateur qui vient de creer un compte. Il n'a effectue aucun paiement. Il est en periode d'essai gratuite de 7 jours.

**Exemple :** Amadou cree son compte le 1er mai. Il explore le dashboard, configure son agent, mais n'a encore rien paye. Nous sommes le 4 mai — il lui reste 3 jours.

**Ce que voit Amadou :**
Banniere ambre en haut du dashboard avec un compte a rebours en direct : `03j 14h 22m 05s`. Badge "Compte test". Titre : "Compte en periode d'essai — suppression le 8 mai 2026 a 14h32". Bouton vert "Choisir un abonnement".

**Ce qu'il peut faire :** Utiliser la plateforme normalement. 1 agent autorise. Les 10 credits offerts a la creation sont utilisables.

**S'il ne fait rien :** Le cron quotidien detecte le 9 mai que la deadline est passee, verifie qu'aucun abonnement n'a ete complete, et supprime definitivement le compte avec tous ses agents et donnees.

**Variables cles :**
- `account_lifecycle_status = test`
- `test_account_cleanup_deadline = 08/05 a 14h32`
- `paid_until = null`

---

### Etat 2 — Compte test actif + credits achetes (sans abonnement)

**Qui est concerne :** Un utilisateur encore en periode d'essai (7 jours non ecoules) qui a achete un pack de credits mais pas d'abonnement.

**Exemple :** Fatou cree son compte le 1er mai. Le 3 mai, elle achete un Boost M (1 800 credits / 25 000 FCFA). Nous sommes le 5 mai — il lui reste 3 jours d'essai.

**Ce que voit Fatou :**
La meme banniere ambre qu'en Etat 1, avec le compte a rebours. En plus, un sous-message en jaune apparait sous la description : "Vous avez des credits en attente. Ils seront disponibles des la souscription a un abonnement."

**Ce qui se passe en coulisses :** Les 1 800 credits ont ete credites a son solde via `add_credits`, mais comme elle n'a pas d'abonnement actif (`paid_until = null`), ces credits sont inutilisables. Son statut reste `test`. La deadline du 8 mai n'a pas bouge.

**Si elle souscrit avant le 8 mai :** Son compte sort du test, `paid_until` est ouvert, ses agents sont actives selon le plan, et ses 1 800 credits deviennent immediatement utilisables en plus des credits du plan souscrit.

**Si elle ne fait rien avant le 8 mai :** Elle passe en Etat 4 (grace 30j avec credits).

**Variables cles :**
- `account_lifecycle_status = test`
- `test_account_cleanup_deadline = 08/05`
- `paid_until = null`
- `credits_balance = 1 800` (geles)

---

### Etat 3 — Test expire, cron pas encore passe (fenetre < 24h)

**Qui est concerne :** Un compte test dont la deadline de 7 jours est depassee, mais le cron de nettoyage n'a pas encore tourne. Cette fenetre dure au maximum jusqu'a minuit du meme jour.

**Exemple :** Kwame a cree son compte le 1er mai. Sa deadline est le 8 mai a 14h32. Il est 22h15 — la deadline est passee depuis 8 heures, mais le cron tourne a minuit. Le compte n'est pas encore supprime.

**Ce que voit Kwame :**
La banniere passe au rouge. Badge "Action requise". Titre : "Periode d'essai terminee — suppression imminente". Le compte a rebours affiche `00j 00h 00m 00s`. Bouton vert "Choisir un abonnement" — il peut encore agir.

**S'il souscrit maintenant :** `markUserAsQualified()` est appele, la deadline est effacee, le compte est sauve. Le cron de minuit le verra qualifie et ne le supprimera pas.

**S'il ne fait rien jusqu'a minuit :** Le cron detecte `shouldDelete = true`, aucun abonnement ni credit achete → suppression immediate.

**Variables cles :**
- `account_lifecycle_status = test`
- `test_account_cleanup_deadline` = date dans le passe
- `isExpired = true`

---

### Etat 4 — Test expire → grace 30j avec credits achetes

**Qui est concerne :** Un utilisateur qui avait achete des credits pendant son essai sans souscrire d'abonnement. Sa deadline de 7 jours est passee. Le cron a detecte les credits et lui accorde 30 jours supplementaires au lieu de le supprimer.

**Exemple :** Fatou (reprise de l'Etat 2) n'a pas souscrit avant le 8 mai. Le cron tourne a minuit du 9 mai. Il detecte un paiement de type `credits` complete. Au lieu de supprimer le compte, il met :
- `account_lifecycle_status = frozen_grace`
- `grace_until = 8 juin a 00h00`
- `credits_frozen_at = 9 mai 00h00`
- `credits_expire_at = 8 juin 00h00`
- `test_account_cleanup_deadline = 8 juin 00h00` (reschedulee)
- Ses agents sont archives

**Ce que voit Fatou le lendemain matin :**
Banniere ambre (pas rouge — c'est une invitation, pas une sanction). Badge "Credits en attente". Titre : "Credits en attente — souscrivez avant le 8 juin 2026 a 00h00". Description complete : "Vous avez des credits que vous avez achetes pendant votre essai. Ces credits sont actuellement geles. Souscrivez un abonnement avant le 8 juin pour les recuperer et commencer a les utiliser. Passe cette date, votre compte et vos credits seront definitivement supprimes." Bouton vert "Choisir un abonnement". Compte a rebours visible.

**Si elle souscrit avant le 8 juin :** `markUserAsQualified()` appele, `paid_until` ouvert, agents reactives, credits geles recuperes et utilisables immediatement.

**Si elle ne fait rien avant le 8 juin :** Le cron detecte `test_account_cleanup_deadline = 8 juin` depasse, `alreadyInGrace = true` (deja en frozen_grace) → pas de nouvelle grace → suppression definitive.

**Variables cles :**
- `account_lifecycle_status = frozen_grace`
- `grace_until = 8 juin`
- `credits_frozen_at = 9 mai`
- `credits_expire_at = 8 juin`
- `paid_until = null`

---

### Etat 5 — Test expire → grace 30j sans credits (edge case)

**Qui est concerne :** Cas rare. Un utilisateur mis en grace par le cron (car il avait des paiements credits) mais dont le solde de credits affiche 0 — par exemple suite a une migration de donnees ou une anomalie.

**Exemple :** Meme situation que l'Etat 4, mais `credits_balance = 0` au moment ou la banniere est affichee.

**Ce que voit l'utilisateur :**
Banniere ambre. Badge "Essai expire". Titre : "Periode d'essai terminee — souscrivez avant le 8 juin 2026". Description : "Votre periode d'essai de 7 jours est terminee. Vous disposez de 30 jours jusqu'au 8 juin pour souscrire un abonnement et conserver votre compte. Passe cette date, votre compte sera definitivement supprime." Bouton vert "Choisir un abonnement".

**Note produit :** Ce cas ne devrait quasiment pas se produire en production car les credits sans abonnement sont geles (non consommables). Il est prevu par securite pour les cas anormaux.

**Variables cles :**
- `account_lifecycle_status = frozen_grace`
- `grace_until = 8 juin`
- `credits_balance = 0`
- `paid_until = null`

---

### Etat 6 — Abonne expire (en grace 30j)

**Qui est concerne :** Un utilisateur qui avait un abonnement actif (`paid_active`), dont le `paid_until` est depasse, et qui se trouve maintenant dans sa fenetre de grace de 30 jours. Ses agents sont archives, ses credits sont geles.

**Exemple :** Kofi avait un abonnement Pro mensuel actif jusqu'au 1er mai. Le cron `checkExpiredSubscriptions` a tourne le 2 mai au matin et a appele `freezePaidLifecycleForUser()` qui a :
- Mis `account_lifecycle_status = frozen_grace`
- Calcule `grace_until = paid_until + 30j = 31 mai`
- Mis `credits_frozen_at = 2 mai`
- Archive tous ses agents

Nous sommes le 10 mai. Il reste 21 jours a Kofi.

**Ce que voit Kofi :**
Banniere rouge (urgence — ses agents sont inactifs, ses clients ne recoivent plus de reponses). Badge "Abonnement expire". Titre : "Abonnement expire — regularisez avant le 31 mai 2026 a 02h14". Description : "Votre abonnement a expire. Tous vos agents sont desactives et vos credits sont geles. Renouvelez votre abonnement avant le 31 mai pour reactiver vos agents et recuperer vos credits geles. Passe cette date, votre compte sera definitivement supprime." Bouton rouge "Renouveler maintenant". Compte a rebours en direct : `21j 14h 03m 22s`.

**Si Kofi renouvelle avant le 31 mai :** `reactivateArchivedAgentsForPlan()` reactive ses agents selon les limites du plan, ses credits geles sont restaures et cumules avec les credits du nouveau plan, `paid_until` est recalcule depuis la date du paiement (ex : paiement le 15 mai → `paid_until = 15 juin`).

**Si Kofi ne fait rien avant le 31 mai :** Il passe en Etat 7.

**Variables cles :**
- `account_lifecycle_status = frozen_grace`
- `paid_until = 01/05` (dans le passe)
- `grace_until = 31/05`
- Agents : archives
- Credits : geles

---

### Etat 7 — Abonne → grace ecoulee (acces bloque)

**Qui est concerne :** Un ex-abonne dont les 30 jours de grace sont ecoules sans renouvellement. Le compte est en etat `inactive`. Tout acces aux fonctions payantes est bloque.

**Exemple :** Kofi n'a pas renouvele avant le 31 mai. Le cron du 1er juin detecte `grace_until <= now`, marque `account_lifecycle_status = inactive`, et declenche la procedure de suppression differee.

**Ce que voit Kofi s'il se connecte le 1er juin :**
Banniere rouge vif, sans compte a rebours (la deadline est passee). Badge "Paiement requis". Titre : "Abonnement expire depuis plus de 30 jours — paiement requis". Description : "Votre abonnement a expire depuis plus de 30 jours et votre periode de grace est ecoulee. La creation d'agents, les reactivations et les connexions WhatsApp sont bloquees. Un nouveau paiement est requis pour restaurer l'acces." Bouton rouge "Renouveler maintenant".

**Ce qui est bloque cote API :** `shouldBlockAgentProvisioning = true`. Toute tentative de creer un agent, reactiver un agent ou connecter WhatsApp retourne : "Votre abonnement a expire et la periode de grace est ecoulee. Un nouveau paiement est requis pour [action]."

**Si Kofi paye maintenant :** Si le compte n'est pas encore supprime (delai entre marquage `inactive` et passage du cron de suppression), le paiement peut encore restaurer l'acces. Mais ce n'est plus garanti selon le timing du cron.

**S'il ne fait rien :** Le cron de suppression differee supprime definitivement le compte, tous les agents, toutes les donnees. Action irreversible.

**Variables cles :**
- `account_lifecycle_status = inactive`
- `paid_until = 01/05` (dans le passe)
- `grace_until = 31/05` (dans le passe)
- `shouldBlockAgentProvisioning = true`

---

### Flux chronologique complet

```
J0  Creation du compte
     |
     +-- J0 a J7 : Etat 1 (test, sans credits) ou Etat 2 (test, avec credits geles)
     |              Banniere ambre | Countdown | Bouton vert
     |
     +-- J7 depasse, cron pas encore passe : Etat 3
     |              Banniere rouge | "suppression imminente"
     |
     +-- Cron J7/J8 :
          |
          +-- Aucun paiement -------> SUPPRESSION DEFINITIVE
          |
          +-- Credits achetes ------> Etat 4 (grace 30j, credits) ou Etat 5 (grace 30j, sans credits)
                   |                  Banniere ambre | Countdown 30j | Bouton vert
                   |
                   +-- Abonnement souscrit --> Compte actif (paid_active)
                   |
                   +-- Rien jusqu'a J37 ----> SUPPRESSION DEFINITIVE

J0  Premier abonnement souscrit
     |
     +-- Pendant paid_until : Compte actif, aucune banniere
     |
     +-- paid_until depasse : Cron freeze
          |
          +-- Etat 6 : frozen_grace 30j
          |            Banniere rouge | Countdown 30j | Bouton rouge
          |
          +-- Renouvellement -------> Compte actif restaure
          |
          +-- Rien jusqu'a J30 ----> Etat 7 : inactive
                   |                 Banniere rouge | Acces bloque | Bouton rouge
                   |
                   +-- SUPPRESSION DEFINITIVE
```

---

## 13. Decision produit finale (Patch 5)

- **test sans abonnement** : 7 jours puis suppression
- **test avec credits achetes** : 7 jours test + grace 30j a l'expiration pour souscrire
- **abonnement** : sortie du test, `paid_until` ouvert, agents actives
- **meme plan renouvele** : prolongation depuis la fin actuelle
- **plan different** : nouvelle periode depuis la date du paiement
- **credits pendant abonnement actif** : credits ajoutes, echeance inchangee
- **credits sans abonnement** : credits geles, aucune periode ouverte
- **fin de periode abonnement** : gel 30 jours (grace)
- **fin de grace sans paiement** : suppression differee

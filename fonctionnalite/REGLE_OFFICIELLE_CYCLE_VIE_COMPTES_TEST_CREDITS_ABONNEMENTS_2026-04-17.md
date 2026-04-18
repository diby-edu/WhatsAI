# Regle officielle - cycle de vie comptes test, credits et abonnements

**Date :** 2026-04-17  
**Statut :** Valide produit - base de travail avant implementation du Patch 4  
**Objectif :** definir une logique unique, explicite et non ambigue pour les comptes test, les comptes payants, les achats de credits, les expirations, le gel, le delai de grace et la suppression differee.

---

## 1. Principe general

Il existe deux grandes familles de comptes :

1. **Compte test sans paiement**
2. **Compte ayant deja effectue au moins un paiement**

Un compte qui n'a **jamais** effectue de paiement reste dans la logique test.  
Un compte qui a effectue **au moins un paiement** sort **definitivement** du statut test.

Un paiement peut etre :

- un abonnement
- un achat de credits

---

## 2. Regles centrales a appliquer

### 2.1 Compte test sans paiement

- delai test : **7 jours**
- si aucun paiement pendant ce delai : **suppression**

### 2.2 Premier paiement

- le compte sort immediatement du statut test
- une **periode payante** est ouverte
- cette periode payante est representee par une date unique : **paid_until**

### 2.3 Fin de periode payante

Quand `paid_until` est depasse :

- le compte passe en **etat gele**
- les agents sont desactives
- les credits restants sont geles
- un delai de grace commence : **grace_until**

### 2.4 Fin du delai de grace

Si aucun nouveau paiement avant `grace_until` :

- suppression differee du compte
- suppression des agents, donnees et dependances associees

---

## 3. Dates de reference uniques

La logique doit etre pilotee autour de ces dates :

- `test_until` : fin du test gratuit de 7 jours
- `paid_until` : fin de la periode payante active
- `grace_until` : fin du delai de grace apres expiration

Il ne faut pas multiplier les interpretations metier concurrentes.  
La source de verite fonctionnelle doit rester simple :

- **compte test actif**
- **compte payant actif**
- **compte gele en grace**
- **compte supprimable**

---

## 4. Duree a retenir

### 4.1 Compte test

- duree : **7 jours**

### 4.2 Paiement abonnement mensuel

- ouvre une periode payante de **1 mois**

### 4.3 Paiement abonnement annuel

- ouvre une periode payante de **1 an**

### 4.4 Paiement credits

- ouvre une periode payante de **1 mois**
- meme si le paiement est un simple pack credits

### 4.5 Delai de grace apres expiration

- duree : **30 jours**

---

## 5. Regles detaillees par scenario

## 5.1 Nouveau compte test - aucun paiement

### Regle

- un nouveau compte sans paiement commence en periode test
- il dispose de 7 jours
- s'il ne paie pas, il est supprime

### Exemple

- creation du compte : **14/07/2026**
- fin du test : **21/07/2026**
- aucun paiement avant cette date

### Resultat

- le compte est supprime apres la fin de la periode test
- les agents, sessions et donnees rattachees sont supprimes avec lui

---

## 5.2 Compte test qui achete des credits

### Regle

- il sort immediatement du statut test
- un achat de credits ouvre une vraie periode payante
- la duree retenue est **1 mois**

### Exemple

- creation du compte : **14/07/2026**
- achat de credits : **16/07/2026**

### Resultat

- le compte n'est plus un compte test
- `paid_until = 16/08/2026`
- il entre dans la logique payante unifiee

---

## 5.3 Compte test qui souscrit un abonnement

### Regle

- il sort immediatement du statut test
- la date `paid_until` depend de l'abonnement achete

### Exemple mensuel

- creation du compte : **14/07/2026**
- achat abonnement mensuel : **18/07/2026**

### Resultat

- `paid_until = 18/08/2026`

### Exemple annuel

- creation du compte : **14/07/2026**
- achat abonnement annuel : **18/07/2026**

### Resultat

- `paid_until = 18/07/2027`

---

## 5.4 Meme plan actif + renouvellement du meme plan

### Regle

- on prolonge la periode a partir de l'echeance actuelle
- on n'utilise pas la date du jour comme nouveau point de depart

### Exemple mensuel

- aujourd'hui : **20/07/2026**
- plan actuel : **Pro mensuel**
- echeance actuelle : **14/08/2026**
- le client renouvelle **le meme plan**

### Resultat

- nouvelle echeance : **14/09/2026**

### Exemple annuel

- aujourd'hui : **10/01/2027**
- plan actuel : **Scale annuel**
- echeance actuelle : **14/07/2027**
- le client renouvelle **le meme plan**

### Resultat

- nouvelle echeance : **14/07/2028**

### Pourquoi

Le client ne doit pas perdre du temps deja paye.  
Un renouvellement du meme plan doit donc s'ajouter a la fin de la periode en cours.

---

## 5.5 Plan different pendant une periode encore active

### Regle

- si le client change de plan pendant une periode active
- le nouveau plan est applique immediatement
- une **nouvelle periode complete** repart a partir de la date du paiement

### Exemple mensuel

- aujourd'hui : **20/07/2026**
- plan actuel : **Starter mensuel**
- echeance actuelle : **14/08/2026**
- upgrade vers **Pro mensuel**

### Resultat

- le plan Pro devient actif tout de suite
- nouvelle echeance : **20/08/2026**

### Exemple limite

- plan actuel : **Starter mensuel**
- echeance actuelle : **14/08/2026**
- upgrade vers **Pro mensuel** le **13/08/2026**

### Resultat

- nouvelle echeance : **13/09/2026**

### Pourquoi

Il ne serait pas correct de faire payer le prix plein d'un nouveau plan pour seulement un ou deux jours restants.

### Exemple annuel

- plan actuel : **Pro annuel**
- echeance actuelle : **14/07/2027**
- upgrade vers **Scale annuel** le **10/01/2027**

### Resultat

- nouvelle echeance : **10/01/2028**

---

## 5.6 Achat de credits pendant une periode payante deja active

### Regle

- on ajoute les credits
- on ne modifie pas `paid_until`

### Exemple

- periode payante active jusqu'au **14/08/2026**
- achat de credits le **18/07/2026**

### Resultat

- credits ajoutes immediatement
- `paid_until` reste **14/08/2026**

### Pourquoi

Le pack credits ne doit pas empiler du temps si le compte est deja dans une fenetre payante active.

---

## 5.7 Achat de credits sur compte free, test ou expire

### Regle

- s'il n'existe pas de periode payante active
- un achat de credits ouvre une nouvelle periode payante de 1 mois

### Exemple compte test

- compte test cree le **14/07/2026**
- achat de credits le **16/07/2026**

### Resultat

- `paid_until = 16/08/2026`

### Exemple compte expire

- ancienne echeance : **14/08/2026**
- aucun paiement jusqu'au **25/08/2026**
- achat de credits le **25/08/2026**

### Resultat

- `paid_until = 25/09/2026`
- le compte redevient payant actif

---

## 5.8 Compte payant qui expire sans nouveau paiement

### Regle

Quand `paid_until` est depasse :

- le compte passe en gel
- les agents sont desactives
- les credits restants sont geles
- un delai de grace de 30 jours commence

### Exemple

- `paid_until = 14/08/2026`
- aucun paiement au **15/08/2026**

### Resultat

- compte gele a partir du **15/08/2026**
- `grace_until = 14/09/2026`

---

## 5.9 Paiement pendant le delai de grace

### Regle

- si un paiement intervient avant `grace_until`
- le compte est restaure
- une nouvelle periode payante est ouverte selon le type de paiement

### Exemple abonnement

- `paid_until = 14/08/2026`
- `grace_until = 14/09/2026`
- paiement abonnement mensuel le **05/09/2026**

### Resultat

- compte restaure
- agents reactives
- credits geles restaures
- nouvelle echeance : **05/10/2026**

### Exemple credits

- `paid_until = 14/08/2026`
- `grace_until = 14/09/2026`
- achat credits le **05/09/2026**

### Resultat

- compte restaure
- agents reactives
- credits geles restaures
- nouvelle echeance : **05/10/2026**

---

## 5.10 Aucun paiement jusqu'a la fin de la grace

### Regle

- si `grace_until` est depasse sans nouveau paiement
- le compte devient supprimable
- une suppression differee automatique est executee

### Exemple

- `paid_until = 14/08/2026`
- `grace_until = 14/09/2026`
- aucun paiement au **15/09/2026**

### Resultat

- suppression differee du compte
- suppression des agents, sessions et donnees rattachees

---

## 6. Ce qui doit arriver aux agents

### Pendant une periode payante active

- agents autorises selon les limites du plan

### A l'expiration

- les agents sont desactives
- les connexions WhatsApp associees sont coupees ou invalidees selon la logique technique retenue

### Pendant la grace

- les agents restent desactives

### En cas de paiement pendant la grace

- les agents doivent etre reactivables

### En cas de suppression finale

- les agents sont supprimes avec le compte

---

## 7. Ce qui doit arriver aux credits

### Pendant une periode payante active

- credits utilisables normalement

### A l'expiration

- credits restants geles
- ils deviennent inaccessibles pendant la grace

### En cas de paiement pendant la grace

- credits geles restaures
- puis ajout des credits du nouveau paiement si applicable

### En cas de suppression finale

- les credits geles restants sont perdus

---

## 8. Regles de produit a ne pas melanger

### Regle A - Renouvellement du meme plan

- on ajoute a la fin de l'echeance actuelle

### Regle B - Changement de plan

- on repart de la date du paiement

### Regle C - Credits pendant periode active

- on ajoute les credits
- on ne change pas l'echeance

### Regle D - Credits sans periode active

- on ouvre une nouvelle periode payante

---

## 9. Cas pratiques ultra courts

### Cas 1

- test cree le **14/07**
- aucun paiement
- suppression apres **21/07**

### Cas 2

- test cree le **14/07**
- credits achetes le **16/07**
- `paid_until = 16/08`

### Cas 3

- Pro actif jusqu'au **14/08**
- renouvellement Pro le **20/07**
- `paid_until = 14/09`

### Cas 4

- Starter actif jusqu'au **14/08**
- upgrade Pro le **13/08**
- `paid_until = 13/09`

### Cas 5

- compte actif jusqu'au **14/08**
- achat credits le **18/07**
- credits ajoutes
- echeance reste **14/08**

### Cas 6

- compte expire le **14/08**
- achat credits le **25/08**
- `paid_until = 25/09`

### Cas 7

- compte expire le **14/08**
- grace jusqu'au **14/09**
- abonnement paye le **05/09**
- `paid_until = 05/10`

### Cas 8

- compte expire le **14/08**
- grace jusqu'au **14/09**
- aucun paiement
- suppression apres **14/09**

---

## 10. Recommandation implementation prudente

Pour ne pas casser la production, le Patch 4 doit etre implemente par petites phases :

1. ajouter une source de verite lifecycle unique en base
2. brancher des gardes de lecture uniquement
3. brancher ensuite les actions de gel
4. brancher ensuite la restauration
5. activer enfin la suppression differee

Il ne faut pas melanger dans un seul patch :

- schema
- crons
- UI
- guards API
- reactivation agents
- suppression finale

Chaque bloc doit etre valide separement.

---

## 11. Decision produit finale retenue

La logique retenue est la suivante :

- **test sans paiement** : 7 jours puis suppression
- **premier paiement** : sortie definitive du test
- **meme plan renouvele** : prolongation depuis la fin actuelle
- **plan different** : nouvelle periode depuis la date du paiement
- **credits pendant periode active** : credits ajoutes, echeance inchangée
- **credits sans periode active** : nouvelle periode payante
- **fin de periode payante** : gel
- **fin de grace sans paiement** : suppression differee

Cette regle est la base officielle avant implementation du Patch 4.

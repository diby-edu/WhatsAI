# Plan — Libelles de statuts par type de produit

## Objectif

Conserver des statuts internes stables en base de donnees, tout en affichant
des libelles plus clairs selon :

- le type de produit : `physique`, `numerique`, `service`
- le mode d'execution : `delivery`, `takeaway`, `booking`
- le canal : WhatsApp client, dashboard marchand, admin

Ce plan ne change pas encore le code. Il documente la cible produit.

---

## Principe directeur

Le code interne reste technique et stable :

- `pending`
- `paid`
- `confirmed`
- `processing`
- `pending_pickup`
- `pending_delivery`
- `shipped`
- `delivered`
- `cancelled`
- `refunded`

Mais le texte visible doit etre metier et explicite.

Exemple :

- en base : `pending_pickup`
- dashboard : `En attente de retrait`
- WhatsApp client : `Votre commande est validee. Retrait prevu le mercredi 1 avril a 16:00.`

Le client ne doit jamais voir un code interne brut.

---

## Statuts actuels en base

### 1. `orders.status`

Statuts actuellement acceptes par l'API commande :

- `pending`
- `paid`
- `confirmed`
- `processing`
- `shipped`
- `delivered`
- `cancelled`
- `pending_delivery`
- `pending_pickup`
- `refunded`

### 2. `bookings.status`

Statuts actuellement acceptes par l'API reservation :

- `pending`
- `confirmed`
- `completed`
- `cancelled`
- `inscription_pending`

### 3. `deposit_status`

Statuts d'acompte utilises pour reservations et commandes restaurant :

- `pending`
- `paid`
- `expired`
- `waived`
- `not_required`

---

## Sens metier des statuts

### Commandes

- `pending` : la commande existe mais attend encore une etape cle
- `paid` : le paiement total a ete recu
- `confirmed` : la commande est validee cote operationnel
- `processing` : la commande est en preparation
- `pending_pickup` : commande takeaway validee, en attente de retrait
- `pending_delivery` : commande a livrer, en attente de depart ou de livraison
- `shipped` : commande expediee / en route
- `delivered` : commande remise au client
- `cancelled` : commande annulee
- `refunded` : commande remboursee

### Reservations

- `pending` : reservation creee mais pas encore confirmee
- `confirmed` : reservation confirmee
- `completed` : reservation / prestation terminee
- `cancelled` : reservation annulee
- `inscription_pending` : inscription en attente de confirmation

### Acompte

- `pending` : acompte attendu
- `paid` : acompte recu
- `expired` : paiement non abouti / expire / refuse
- `waived` : acompte leve manuellement
- `not_required` : aucun acompte necessaire

---

## Plan d'affichage par type de produit

## A. Produit physique

Exemples :

- vetement
- accessoire
- produit alimentaire emballe
- commande takeaway restaurant

### 1. Physique + livraison

| Statut base | Libelle dashboard recommande | Libelle client WhatsApp recommande |
|---|---|---|
| `pending` | En attente | Votre commande est en attente de validation. |
| `paid` | Payee | Votre paiement a ete recu. Votre commande est en preparation. |
| `processing` | En preparation | Votre commande est en cours de preparation. |
| `pending_delivery` | En attente de livraison | Votre commande est prete pour la livraison. |
| `shipped` | En route | Votre commande est en route. |
| `delivered` | Livree | Votre commande a ete livree. |
| `cancelled` | Annulee | Votre commande a ete annulee. |
| `refunded` | Remboursee | Votre commande a ete remboursee. |

### 2. Physique + retrait (`takeaway`)

C'est le point le plus important a clarifier.

Statut actuel en base juste apres paiement :

- `pending_pickup`

Probleme UX :

- `pending_pickup` ne veut pas toujours dire "commande deja prete sur le comptoir"
- dans le code actuel, ce statut peut arriver des la validation du paiement

Proposition d'affichage :

| Statut base | Libelle dashboard recommande | Libelle client WhatsApp recommande |
|---|---|---|
| `pending` | En attente | Votre commande est en attente de validation. |
| `pending_pickup` | En attente de retrait | Votre commande est validee. Retrait prevu le ... |
| `confirmed` | Prete pour retrait | Votre commande est prete pour retrait. |
| `delivered` | Retiree | Votre commande a bien ete retiree. |
| `cancelled` | Annulee | Votre commande a ete annulee. |

### Exemple recommande

#### Apres paiement takeaway

- base : `pending_pickup`
- dashboard : `En attente de retrait`
- WhatsApp : `Votre commande est validee. Retrait prevu le mercredi 1 avril a 16:00.`

#### Quand le marchand a vraiment prepare la commande

- base : `confirmed`
- dashboard : `Prete pour retrait`
- WhatsApp : `Votre commande est prete pour retrait. Vous pouvez passer la recuperer.`

#### Quand le client est venu

- base : `delivered`
- dashboard : `Retiree`
- WhatsApp : `Votre commande a bien ete retiree. Merci pour votre confiance.`

---

## B. Produit numerique

Exemples :

- licence
- ebook
- code d'activation
- acces prive

Le client ne doit pas suivre une logique de livraison physique.

| Statut base | Libelle dashboard recommande | Libelle client WhatsApp recommande |
|---|---|---|
| `pending` | En attente de paiement | Votre commande est en attente de paiement. |
| `paid` | Paiement recu | Votre paiement a ete confirme. Livraison numerique en cours. |
| `processing` | Livraison numerique en cours | Votre acces est en cours de generation. |
| `delivered` ou `completed` selon le flux | Livre numeriquement | Votre produit numerique a ete livre. |
| `cancelled` | Annule | Votre commande a ete annulee. |
| `refunded` | Rembourse | Votre commande a ete remboursee. |

### Recommandation produit

Pour le numerique, eviter les libelles :

- `En route`
- `Prete pour retrait`
- `Livraison en attente`

Ils n'ont pas de sens pour un produit immateriel.

---

## C. Service

Exemples :

- consultation
- coaching
- reservation coiffeur
- hotel
- reservation restaurant

Le langage doit parler de rendez-vous, de reservation ou de prise en charge,
pas d'expedition.

| Statut base | Libelle dashboard recommande | Libelle client WhatsApp recommande |
|---|---|---|
| `pending` | En attente de confirmation | Votre demande a bien ete recue. |
| `paid` | Paiement recu | Votre paiement a ete confirme. |
| `confirmed` | Confirme | Votre reservation est confirmee. |
| `processing` | En preparation | Votre service est en cours de preparation. |
| `completed` ou `delivered` selon le flux | Termine | Votre prestation est terminee. |
| `cancelled` | Annule | Votre reservation a ete annulee. |

### Cas restaurant dine-in / booking

Exemple avec acompte :

- base reservation : `status = confirmed`
- base acompte : `deposit_status = paid`
- client : `Votre reservation est maintenant confirmee.`

Ici, il ne faut jamais afficher :

- `En route`
- `Retrait`
- `Expedie`

---

## Plan dashboard recommande

## 1. Ce qu'on garde en base

On garde les codes internes actuels pour :

- la compatibilite API
- les webhooks
- les tests
- l'historique

Exemple :

- on garde `pending_pickup` en base
- on change seulement le libelle visible

## 2. Ce qu'on affiche au marchand

Sur les listes dashboard/admin, afficher :

- un badge metier lisible
- eventuellement un sous-texte avec l'horaire ou l'etape suivante

### Proposition de colonnes

- `Statut`
- `Paiement`
- `Etape suivante`

### Exemple commande takeaway payee

- Statut : `En attente de retrait`
- Paiement : `Acompte paye`
- Etape suivante : `Preparer la commande puis marquer "Prete pour retrait"`

### Exemple commande livraison payee

- Statut : `En attente de livraison`
- Paiement : `Paye`
- Etape suivante : `Preparer puis expedier`

### Exemple reservation restaurant avec acompte paye

- Statut : `Reservation confirmee`
- Paiement : `Acompte paye`
- Etape suivante : `Accueillir le client a l'heure reservee`

## 3. Filtres dashboard recommandes

Au lieu d'exposer des codes trop techniques, proposer des filtres lisibles :

- `En attente`
- `A payer`
- `En preparation`
- `Retrait`
- `Livraison`
- `Confirme`
- `Termine`
- `Annule`
- `Rembourse`

Puis mapper en interne :

- `Retrait` -> `pending_pickup`, `confirmed` takeaway
- `Livraison` -> `pending_delivery`, `shipped`
- `Confirme` -> `confirmed` service / booking

## 4. Badges recommandes

| Code interne | Badge recommande |
|---|---|
| `pending` | En attente |
| `paid` | Paiement recu |
| `processing` | En preparation |
| `pending_pickup` | En attente de retrait |
| `pending_delivery` | En attente de livraison |
| `shipped` | En route |
| `confirmed` + takeaway | Prete pour retrait |
| `confirmed` + service | Confirme |
| `delivered` + takeaway | Retiree |
| `delivered` + livraison | Livree |
| `completed` + reservation | Termine |
| `cancelled` | Annule |
| `refunded` | Rembourse |

---

## Exemples WhatsApp recommandes

### Takeaway apres paiement

`Votre commande est validee. Retrait prevu le mercredi 1 avril a 16:00.`

### Takeaway quand le marchand a termine la preparation

`Votre commande est prete pour retrait. Vous pouvez passer la recuperer.`

### Livraison apres paiement

`Votre paiement a ete confirme. Votre commande est en cours de preparation.`

### Livraison apres expedition

`Votre commande est en route.`

### Reservation avec acompte

`Votre acompte a ete confirme. Votre reservation est maintenant confirmee.`

### Echec de paiement acompte

`Nous n'avons pas pu traiter votre acompte. Votre reservation n'est pas confirmee.`

---

## Plan d'implementation futur

### Phase 1 — Libelles dashboard

- remplacer les libelles visibles `Prête pour retrait` par `En attente de retrait` quand le code est `pending_pickup`
- garder `Prête pour retrait` pour `confirmed` sur takeaway
- harmoniser les badges admin et dashboard marchand

### Phase 2 — Messages WhatsApp

- separer les templates par type de produit
- ne plus reutiliser un meme texte "commande confirmee" pour tous les cas
- afficher l'horaire prevu quand `pickup_at` ou `delivery` est connu

### Phase 3 — Filtres et regroupements

- proposer des filtres metier simples
- laisser les codes internes dans le back-office detaille seulement

### Phase 4 — Evolution eventuelle du modele

Si on veut encore plus de precision plus tard, on pourra introduire un statut
supplementaire, par exemple :

- `ready_for_pickup`

Mais ce n'est pas obligatoire maintenant.

Recommandation actuelle :

- ne pas changer la base tout de suite
- d'abord corriger les libelles visibles

---

## Decision recommandee

Decision produit recommandee :

- garder `pending_pickup` en base
- afficher `En attente de retrait` dans le dashboard
- afficher `Retrait prevu` ou `Commande validee pour retrait` au client
- reserver `Prête pour retrait` au moment ou le marchand confirme que la commande est effectivement disponible

Ce compromis preserve :

- la stabilite technique
- la clarte client
- la lisibilite marchand

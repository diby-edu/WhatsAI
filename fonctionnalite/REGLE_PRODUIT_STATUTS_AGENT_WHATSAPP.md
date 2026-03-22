# Regle Produit - Statuts Agent WhatsApp

Date: 2026-03-22

## Objectif

Documenter la regle produit officielle pour les statuts des agents WhatsApp dans :

- le dashboard utilisateur
- le dashboard admin
- les compteurs et segments admin

L'objectif est d'avoir un vocabulaire simple, unique et stable cote produit.

## Regle produit officielle

Un agent ne doit afficher qu'un seul statut principal a la fois.

Les 4 statuts produit officiels sont :

- `Pause`
- `Connecte`
- `A reconnecter`
- `A connecter`

`Actif` n'est pas un statut produit.

`QR a scanner` n'est plus un statut principal du dashboard.

Il peut rester un texte technique dans le parcours de connexion, mais pas comme statut metier principal sur les cartes.

## Regle de priorite

La priorite officielle est :

1. `Pause`
2. `Connecte`
3. `A reconnecter`
4. `A connecter`

En logique metier :

```ts
if (is_active === false) return 'Pause'
if (whatsapp_connected === true) return 'Connecte'
if (whatsapp_ever_connected === true || whatsapp_phone != null) return 'A reconnecter'
return 'A connecter'
```

## Signification exacte de chaque statut

### 1. `Pause`

Signification :

- l'agent est volontairement arrete
- il ne doit plus traiter de messages
- il ne doit plus lancer ou reprendre de connexion WhatsApp

Detail d'affichage :

- `Agent desactive`

Important :

- `Pause` est prioritaire sur tous les autres etats techniques
- meme si une ancienne session WhatsApp existe encore, l'UI doit afficher `Pause`

### 2. `Connecte`

Signification :

- WhatsApp est relie
- l'agent peut fonctionner normalement

Detail d'affichage :

- numero WhatsApp si disponible
- sinon `WhatsApp connecte`

### 3. `A reconnecter`

Signification :

- l'agent a deja ete connecte au moins une fois
- mais sa connexion WhatsApp est actuellement perdue

Detail d'affichage :

- `Connexion WhatsApp perdue`

Important :

- on ne doit afficher `A reconnecter` que si l'agent a deja vraiment marche auparavant
- un agent jamais connecte ne doit jamais tomber dans cette categorie

### 4. `A connecter`

Signification :

- l'agent existe deja dans le systeme
- mais sa premiere connexion WhatsApp n'est pas encore terminee

Detail d'affichage :

- `Premiere connexion en attente`

Important :

- `A connecter` remplace le libelle produit `QR a scanner`
- le QR reste une action de connexion, pas le statut principal

## Regle creation vs fonctionnement

Il faut distinguer deux notions :

- `Cree`
- `Fonctionnel`

Regle officielle :

- un agent est `cree` des qu'il est enregistre en base
- un agent devient `fonctionnel` seulement quand WhatsApp est connecte

Donc :

- un agent peut etre cree sans etre fonctionnel
- dans ce cas son statut doit etre `A connecter`

## Exemples concrets

### Cas 1 - Agent cree, jamais scanne

Valeurs typiques :

- `is_active = true`
- `whatsapp_connected = false`
- `whatsapp_phone = null`
- `whatsapp_ever_connected = false`

Statut attendu :

- `A connecter`

Detail attendu :

- `Premiere connexion en attente`

### Cas 2 - Agent connecte

Valeurs typiques :

- `is_active = true`
- `whatsapp_connected = true`
- `whatsapp_phone = 2250718287025`

Statut attendu :

- `Connecte`

Detail attendu :

- `2250718287025`

### Cas 3 - Agent deja connecte puis deconnecte

Valeurs typiques :

- `is_active = true`
- `whatsapp_connected = false`
- `whatsapp_ever_connected = true`

Statut attendu :

- `A reconnecter`

Detail attendu :

- `Connexion WhatsApp perdue`

### Cas 4 - Agent mis en pause

Valeurs typiques :

- `is_active = false`

Statut attendu :

- `Pause`

Detail attendu :

- `Agent desactive`

## Difference entre statuts et boutons d'action

Les statuts et les boutons n'ont pas le meme role.

### Le statut dit :

- dans quel etat est l'agent maintenant

### Le bouton dit :

- quelle action l'utilisateur ou l'admin peut faire maintenant

## Regle dashboard utilisateur

Le dashboard utilisateur doit afficher :

- un badge de statut unique
- une ligne de detail sous le badge

Exemple attendu :

- `Connecte`
  Detail : numero WhatsApp
- `A reconnecter`
  Detail : `Connexion WhatsApp perdue`
- `A connecter`
  Detail : `Premiere connexion en attente`
- `Pause`
  Detail : `Agent desactive`

Les boutons utilisateur peuvent ensuite rester des actions, par exemple :

- `Tester`
- `QR Code`
- `Modifier`
- `Pause` ou `Activer`

## Regle dashboard admin

Le dashboard admin doit afficher les memes 4 statuts metier :

- `Pause`
- `Connecte`
- `A reconnecter`
- `A connecter`

Mais les boutons admin ne sont pas des statuts.

L'admin peut seulement faire des actions de gestion, par exemple :

- `Pause` / `Activer`
- `Deco. WA`
- `Voir`
- `Supprimer`

Important :

- l'admin ne connecte pas directement WhatsApp a la place du client
- la premiere connexion reste un parcours client avec validation sur le telephone

## Regle affichage QR

`QR Code` reste acceptable comme :

- texte de bouton
- texte de page de connexion
- etape technique du parcours WhatsApp

Mais `QR a scanner` ne doit plus etre le statut principal du produit sur les cartes dashboard.

## Regle technique interne

Les statuts techniques internes peuvent rester :

- `connecting`
- `qr_ready`
- `connected`
- `disconnected`

Le point important est :

- la cle technique interne `qr_ready` peut rester telle quelle
- le libelle affiche au produit est `A connecter`

Autrement dit :

- technique interne != vocabulaire affiche a l'utilisateur

## SQL - Faut-il executer un SQL pour les nouveaux statuts ?

Reponse officielle :

- non pour les nouveaux libelles
- oui seulement pour le champ de memoire `whatsapp_ever_connected` si ce champ n'existe pas encore

Explication :

- `Pause`, `Connecte`, `A reconnecter`, `A connecter` sont des statuts calcules dans le code
- ils ne sont pas stockes tels quels en base
- changer `QR a scanner` en `A connecter` est un changement d'affichage, pas un changement de schema

Le seul point base de donnees important est :

- `whatsapp_ever_connected`

Ce champ sert a distinguer :

- un agent jamais connecte -> `A connecter`
- un agent deja connecte dans le passe -> `A reconnecter`

## Quand un SQL est necessaire

Un SQL est necessaire seulement si :

- `whatsapp_ever_connected` n'existe pas encore
- ou si son backfill n'a pas encore ete fait sur les anciens agents

Si ce champ existe deja et a ete rempli correctement :

- aucun SQL supplementaire n'est necessaire pour le changement de libelles

## Sequence correcte de mise en production

La sequence officielle est :

1. ajouter et backfiller `whatsapp_ever_connected` si necessaire
2. deployer le code qui calcule et affiche les 4 statuts
3. rebuild / restart l'application

## Requete SQL de verification

Cette requete permet de verifier le statut attendu selon la regle officielle :

```sql
select
  id,
  name,
  is_active,
  whatsapp_connected,
  whatsapp_status,
  whatsapp_phone,
  whatsapp_ever_connected,
  case
    when is_active = false then 'Pause'
    when whatsapp_connected = true then 'Connecte'
    when whatsapp_ever_connected = true or whatsapp_phone is not null then 'A reconnecter'
    else 'A connecter'
  end as statut_attendu
from agents
order by created_at desc;
```

## Fichiers de reference

Logique centrale :

- `src/lib/admin/agent-status.ts`

Dashboard utilisateur :

- `src/app/[locale]/dashboard/agents/page.tsx`

Dashboard admin :

- `src/app/[locale]/admin/agents/page.tsx`

Diagnostics admin :

- `src/app/[locale]/admin/diagnostics/page.tsx`
- `src/app/api/admin/diagnostics/whatsapp-service/route.ts`

Segments broadcast admin :

- `src/app/[locale]/admin/broadcasts/page.tsx`

## Decision finale

La regle officielle a retenir est :

- `Pause` > `Connecte` > `A reconnecter` > `A connecter`

Et la phrase produit la plus importante est :

> Un agent est cree des sa sauvegarde. Il devient fonctionnel seulement apres connexion WhatsApp.


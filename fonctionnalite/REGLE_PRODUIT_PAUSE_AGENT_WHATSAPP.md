# Regle Produit - Pause Agent WhatsApp

Date: 2026-03-16

Voir aussi :

- `REGLE_PRODUIT_STATUTS_AGENT_WHATSAPP.md` pour la regle complete des 4 statuts produit (`Pause`, `Connecte`, `A reconnecter`, `A connecter`)

## Objectif

Documenter la regle produit officielle pour la gestion d'un agent WhatsApp en `pause`, afin d'eviter toute ambiguite entre :

- l'etat operationnel de l'agent
- l'etat technique de sa session WhatsApp

## Regle produit

Mettre un agent en pause doit arreter immediatement toute activite du bot, sans detruire son etat WhatsApp memorise.

En une phrase :

> La pause est un arret operationnel, pas une suppression de session.

## Verite operationnelle vs verite technique

### Verite operationnelle

- `is_active`

Cette colonne decide si le bot a le droit d'agir.

Si `is_active = false` :

- le bot ne doit plus traiter les messages de cet agent
- le bot ne doit plus lancer de scan
- le bot ne doit plus tenter de reconnexion automatique
- l'agent doit etre considere comme `Pause` dans l'UI

### Verite technique

- `whatsapp_status`
- `whatsapp_connected`
- `whatsapp_phone`
- `whatsapp_qr_code`

Ces champs representent le dernier etat technique WhatsApp connu.

Ils peuvent etre conserves meme si l'agent est en pause, pour permettre une reprise propre plus tard.

## Comportement attendu

### 1. Quand un agent est mis en pause

Le systeme doit :

- fermer la socket active si elle existe
- stopper toute activite bot sur cet agent
- annuler les reconnexions automatiques futures
- ignorer cet agent dans le polling de setup

Le systeme ne doit pas :

- supprimer automatiquement la session WhatsApp
- vider automatiquement `whatsapp_phone`
- forcer un nouveau QR
- relancer un scan tant que l'agent reste en pause

### 2. Quand un agent est reactive

Le systeme peut reprendre a partir de l'etat technique deja memorise.

Cas possibles :

- si une session valide existe encore, reprise sans re-scan
- si un QR etait deja en attente, reprise du flux de scan
- si aucune session valable n'existe, scan requis

### 3. Quand un utilisateur demande une vraie deconnexion WhatsApp

La deconnexion WhatsApp est un acte different de la pause.

Dans ce cas, le systeme peut explicitement :

- couper la liaison
- vider `whatsapp_phone`
- remettre `whatsapp_status` a `disconnected`
- vider `whatsapp_qr_code`

## Pourquoi ce design est recommande

Ce design est le plus professionnel pour ce produit parce qu'il privilegie :

- le controle explicite par l'utilisateur ou l'admin
- la stabilite du bot
- la reprise sans friction
- la reduction des rescans inutiles

Ce qu'on cherche a eviter :

- qu'une simple pause casse une session encore saine
- qu'un agent doive rescanner inutilement apres une reactivation
- qu'un etat technique residuel soit interprete comme une activite bot reelle

## Regle d'interpretation UI

Dans les ecrans dashboard/admin :

- `Pause` doit etre prioritaire si `is_active = false`
- meme si `whatsapp_status` vaut encore `qr_ready`, `connected` ou `disconnected`

Autrement dit :

- l'utilisateur doit voir l'etat operationnel en premier
- pas le dernier etat technique memorise

## Garde-fous attendus dans le code

Le systeme doit respecter les points suivants :

1. le polling de setup ne prend que les agents `is_active = true`
2. la reconnexion auto s'annule si l'agent est devenu inactif
3. l'API de connexion WhatsApp refuse un agent en pause
4. l'API de statut WhatsApp peut renvoyer `paused` si l'agent est inactif
5. l'UI de scan ne doit pas proposer un nouveau QR pour un agent en pause

## Audit rapide en production

### Requete 1 - verifier qu'aucun agent en pause n'est repris dans le flux de scan

```sql
select
  a.id,
  a.name,
  a.is_active,
  a.whatsapp_connected,
  a.whatsapp_status,
  a.whatsapp_phone,
  a.updated_at
from agents a
where
  a.is_active = false
  and a.whatsapp_status in ('connecting', 'qr_ready')
order by a.updated_at desc;
```

Interpretation :

- un resultat n'indique pas forcement un bug actif
- il peut simplement s'agir d'un dernier etat technique memorise
- pour confirmer un vrai probleme, verifier que `updated_at` continue de bouger ou que le bot reprend encore cet agent dans ses logs

### Requete 2 - voir les agents actifs encore dans le flux de setup

```sql
select
  a.id,
  a.name,
  a.is_active,
  a.whatsapp_connected,
  a.whatsapp_status,
  a.whatsapp_phone,
  a.updated_at,
  exists (
    select 1
    from whatsapp_sessions ws
    where ws.session_id = a.id::text
  ) as has_saved_session
from agents a
where
  a.is_active = true
  and a.whatsapp_status in ('connecting', 'qr_ready')
order by a.updated_at desc;
```

Interpretation :

- cette requete montre les agents actifs qui attendent vraiment un scan ou une reprise
- `has_saved_session = true` aide a comprendre si une session existe encore

## Decision finale

La pause doit rester une suspension operationnelle.

Elle ne doit pas etre transformee en "hard reset" automatique de la session WhatsApp.

La logique officielle a retenir est donc :

- `is_active` = verite operationnelle
- `whatsapp_status` et les champs associes = dernier etat technique memorise

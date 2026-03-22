# Plan - Resolution LID vers vrai numero WhatsApp

## Objectif

Resoudre proprement les conversations WhatsApp qui affichent un `LID` ou `status@broadcast` au lieu d'un vrai numero exploitable.

Le but est de :

- ne plus creer de conversations parasites `status@broadcast`
- afficher le vrai numero quand WhatsApp le fournit
- conserver un identifiant technique fiable pour l'envoi sortant
- eviter de casser l'existant en production

## Constat actuel

### 1. Baileys fournit bien les informations utiles

La version installee de Baileys expose :

- l'evenement `contacts.upsert`
- des contacts avec `lid` et `phoneNumber`
- des messages avec `remoteJidAlt` et `participantAlt`

Donc la resolution `LID -> vrai numero` est techniquement possible dans de nombreux cas.

### 2. Le code actuel perd une partie de l'information

Aujourd'hui :

- certains flux nettoient et jettent le suffixe `@lid`
- certaines conversations sont creees avec `contact_phone` contenant en fait un identifiant technique
- l'UI affiche parfois simplement le `LID` sans suffixe, comme si c'etait un numero

### 3. La prod a deja `contact_jid`

Verification faite sur la base de prod :

- `conversations.contact_jid` existe
- `conversations.bot_paused` existe

Mais le repo est en drift partiel :

- les migrations versionnees ne recreent pas cet etat
- `src/types/database.ts` n'est pas aligne avec la base reelle

### 4. Risque principal

Le vrai risque n'est pas `contacts.upsert`.

Le vrai risque est de casser :

- la creation/recherche de conversations
- l'envoi sortant
- l'affichage admin/user
- la compatibilite avec les conversations deja existantes

## Decision recommandee

Ne pas faire une refonte brutale.

Approche recommandee :

1. corriger d'abord en mode compatible prod
2. conserver `contact_phone` pour la compatibilite
3. alimenter proprement `contact_jid`
4. resoudre `contact_phone` quand on a une preuve fiable
5. corriger l'UI et l'outgoing
6. faire le backfill des anciennes conversations seulement si le mapping est certain

## Modele cible recommande

### Verite technique

- `contact_jid`
  - ex: `173272637382900@lid`
  - ex: `2250700000000@s.whatsapp.net`

### Verite metier affichable

- `contact_phone`
  - ex: `2250700000000`
  - seulement si resolu avec certitude

### Regle de base

- `contact_jid` = identifiant technique source de verite pour WhatsApp
- `contact_phone` = numero affichable et metier si resolu

## Sources de resolution a utiliser

### Priorite 1

Utiliser les champs du message entrant :

- `rawMessage.key.remoteJidAlt`
- `rawMessage.key.participantAlt`

Si le message arrive avec :

- `remoteJid = 173272637382900@lid`
- `remoteJidAlt = 2250700000000@s.whatsapp.net`

alors on peut resoudre immediatement :

- `contact_jid = 173272637382900@lid`
- `contact_phone = 2250700000000`

### Priorite 2

Utiliser l'evenement Baileys :

- `contacts.upsert`

Construire une map par agent :

- `lidJid -> pnJid`

Exemple :

- `173272637382900@lid -> 2250700000000@s.whatsapp.net`

### Priorite 3

Si aucune resolution fiable n'existe :

- conserver `contact_jid`
- ne pas inventer un faux numero
- garder `contact_phone` existant si deja valable

## Ce qu'il faut filtrer definitivement

Ne jamais creer de conversation pour :

- `status@broadcast`
- `*@broadcast`
- `*@newsletter`
- `@g.us`

Ces entrees ne sont pas des conversations clients normales.

## Plan d'implementation recommande

### Phase 0 - Remettre le repo au niveau de la prod

Objectif : supprimer le drift schema/code avant la logique LID.

A faire :

- ajouter une migration versionnee pour `conversations.contact_jid` si elle n'existe pas dans le repo
- verifier qu'elle correspond exactement a l'etat de prod
- mettre a jour `src/types/database.ts`
- mettre a jour les types applicatifs si necessaire

Resultat attendu :

- repo, types et prod alignes

### Phase 1 - Filtrer les faux contacts

Objectif : stopper l'apparition de nouvelles conversations parasites.

A faire :

- filtrer `status@broadcast`
- filtrer `*@broadcast`
- filtrer `*@newsletter`
- filtrer `@g.us`

Points a verifier :

- flux JS actif
- flux TS
- handler de creation de conversation

Resultat attendu :

- plus de nouvelles conversations techniques parasites

### Phase 2 - Introduire un resolver LID/PN

Objectif : centraliser la logique de resolution.

Creer un helper unique qui :

- recoit le message brut
- detecte le type de JID
- tente la resolution via `remoteJidAlt` / `participantAlt`
- tente ensuite la resolution via map `contacts.upsert`
- retourne un objet normalise

Exemple de structure cible :

```ts
{
  contactJid: "173272637382900@lid",
  contactPhone: "2250700000000" | null,
  contactJidType: "lid" | "pn" | "broadcast" | "newsletter" | "group",
  resolvedFrom: "message_alt" | "contacts_upsert" | "direct_pn" | "unresolved"
}
```

Resultat attendu :

- un seul endroit responsable de la logique de resolution

### Phase 3 - Alimenter une map LID -> PN par agent

Objectif : exploiter `contacts.upsert`.

A faire :

- ecouter `socket.ev.on('contacts.upsert', ...)`
- construire une map par agent :
  - `Map<agentId, Map<lidJid, pnJid>>`
- normaliser les cles au format JID complet

Important :

- la map memoire seule n'est pas suffisante comme verite durable
- elle doit etre reconstruite a chaque session si necessaire

Resultat attendu :

- les nouveaux messages `@lid` peuvent etre resolus plus souvent

### Phase 4 - Corriger la persistance des conversations

Objectif : stocker proprement le JID technique et le numero resolu.

A faire a la creation/mise a jour :

- toujours enregistrer `contact_jid`
- enregistrer `contact_phone` seulement si un numero resolu est disponible
- mettre a jour `contact_push_name`
- si la conversation existe deja avec un LID et qu'un vrai numero est resolu ensuite, mettre a jour la conversation

Important :

- ne pas deviner un vrai numero a partir de la longueur du LID
- utiliser seulement une preuve fiable

Resultat attendu :

- `contact_jid` devient la verite technique
- `contact_phone` devient une donnee metier plus fiable

### Phase 5 - Corriger l'envoi sortant

Objectif : ne plus reconstruire le destinataire avec des heuristiques fragiles.

A faire :

- utiliser `contact_jid` en priorite pour les envois
- ne construire un JID depuis `contact_phone` qu'en fallback
- supprimer progressivement les heuristiques du type :
  - longueur > 15 => `@lid`

Resultat attendu :

- envoi plus fiable vers les contacts LID et PN

### Phase 6 - Corriger les API et l'affichage

Objectif : ne plus montrer un faux numero.

A faire :

- exposer `contact_jid` dans les API pertinentes
- adapter les listes conversations admin/user
- afficher selon cette regle :
  1. `contact_phone` si vrai numero resolu
  2. sinon `contact_push_name`
  3. sinon un libelle du type `Contact WhatsApp non resolu`

Important :

- ne pas presenter un `LID` comme un numero client

Resultat attendu :

- UI plus honnete et plus lisible

### Phase 7 - Backfill des conversations existantes

Objectif : nettoyer progressivement l'historique.

A faire :

- identifier les conversations contenant un `LID`
- deplacer proprement le JID technique vers `contact_jid` si necessaire
- mettre a jour `contact_phone` seulement si le mapping est certain

Important :

- pas de guess agressif
- pas de conversion basee uniquement sur la longueur

Resultat attendu :

- historique plus propre, sans corruption de donnees

## Strategie de mise en oeuvre en prod

Approche conseillee :

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7

## Ce qu'il ne faut pas faire

Ne pas faire en un seul lot :

- rendre `contact_phone` nullable
- refondre tout le runtime WhatsApp
- migrer tout l'historique
- changer en meme temps toutes les API/UI

Cette approche augmenterait fortement le risque en production.

## Version safe recommandee

Si on veut reduire le risque au maximum :

- garder `contact_phone` tel quel dans un premier lot
- commencer a remplir `contact_jid`
- resoudre le vrai numero quand c'est possible
- corriger l'affichage
- corriger l'outgoing
- faire le backfill seulement apres validation

## Limite a accepter

Il faut accepter une realite technique :

- tous les `LID` ne seront pas resolubles a 100%

Donc, pour certains contacts :

- on pourra afficher un nom ou un libelle technique
- mais pas un vrai numero

Il vaut mieux afficher une information honnete qu'un faux numero.

## Validation attendue apres implementation

### Fonctionnel

- plus de nouvelles conversations `status@broadcast`
- plus de faux numeros affiches pour des `LID`
- affichage du vrai numero quand `remoteJidAlt`, `participantAlt` ou `contacts.upsert` le permet
- envoi sortant fonctionnel avec `contact_jid`

### Donnees

- `contact_jid` renseigne pour les nouvelles conversations LID
- `contact_phone` uniquement quand resolu de maniere fiable
- anciennes conversations migrees seulement si preuve certaine

### UI

- admin conversations : plus d'affichage brut trompeur
- dashboard conversations : meme comportement

## Note finale

Le point central de cette correction est simple :

- ne plus confondre `contact_jid` et `contact_phone`

Tant que ces deux notions restent melangees, les `LID` continueront a polluer l'affichage, la recherche et l'envoi.

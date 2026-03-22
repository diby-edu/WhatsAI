# WhatsApp Bot Stability Plan - 2026-03-13

## Contexte

Analyse basee sur les logs PM2 du process `whatsai-bot` et la lecture du code actif:

- `whatsapp-service.js`
- `src/lib/whatsapp/handlers/session.js`
- `src/lib/whatsapp/supabase-auth.js`
- `src/lib/whatsapp/realtime/listeners.js`
- `src/lib/whatsapp/services/media.service.js`

Le bot demarre, le healthcheck repond, plusieurs agents se connectent, et Realtime s'abonne. Le systeme n'est donc pas mort, mais il est instable.

## Realtime: statut reel

### Ce que disent les logs

Les logs montrent:

- `Master listener registered`
- `Connected!`

Cela prouve que le canal Supabase Realtime s'est bien abonne au moins une fois.

### Limite actuelle

Dans `src/lib/whatsapp/realtime/listeners.js`, lorsque le channel passe en:

- `TIMED_OUT`
- `CLOSED`
- `CHANNEL_ERROR`

le code met seulement `context.realtimeConnected = false` et bascule en fallback polling. Il ne recree pas explicitement le channel.

### Conclusion

- Oui, Realtime fonctionne dans l'etat observe.
- Non, sa reprise apres coupure n'est pas encore suffisamment robuste.

## Erreurs reelles observees

### 1. Timeout reseau VPS -> Supabase

Logs:

- `TypeError: fetch failed`
- `ConnectTimeoutError`
- `Failed to read key creds`
- `Failed to save QR to DB`

Interpretation:

- le VPS n'arrive pas toujours a joindre Supabase en HTTPS dans les temps
- le probleme est reseau / timeout, pas une cle invalide

Impact:

- QR parfois non sauve en base
- credentials WhatsApp parfois non relus
- sessions partielles ou reinitialisees inutilement

### 2. Mauvaise gestion des erreurs auth Supabase

Dans `src/lib/whatsapp/supabase-auth.js`, `readData()` retourne `null` aussi bien:

- si la cle n'existe pas
- que si Supabase a timeout

Ensuite `session.js` fait:

- `readData('creds') || initAuthCreds()`

Impact:

- un timeout peut etre interprete comme "pas de session"
- le bot peut recreer de nouveaux creds alors que la session existe deja

### 3. Session WhatsApp fermee a cause d'une erreur DB

Dans `src/lib/whatsapp/handlers/session.js`, si l'update DB de l'etat `connected` echoue, le code coupe la socket.

Impact:

- la connexion WhatsApp peut etre valide
- mais une erreur DB transitoire suffit a faire tomber la session

### 4. Boucles QR / reconnexions / bruit de logs

Le service:

- rescane les agents `connecting` et `qr_ready`
- lance `checkAgents()` toutes les 5 secondes

Impact:

- beaucoup de bruit
- reinit frequentes si l'etat DB reste intermediaire
- amplification des problemes reseau

### 5. Erreurs image

Log:

- `Cannot derive from empty media key`

Interpretation:

- certains messages image recus ne contiennent pas une media key exploitable
- ou arrivent avant que l'etat crypto soit complet

Impact:

- l'analyse image echoue
- le bot ne plante pas, mais logue une erreur lourde

### 6. Erreurs de decrypt sur `status@broadcast`

Log:

- `No session found to decrypt message`
- `failed to decrypt message`

Interpretation:

- message de type status / broadcast
- non critique dans la plupart des cas
- probablement aggrave par les soucis de lecture des cles Signal

### 7. Warnings non critiques

Logs:

- `Timeout in AwaitingInitialSync`
- `Buffer timeout reached, auto-flushing`
- `transaction failed, rolling back`

Interpretation:

- sync initiale lente
- volume de sessions ou etat crypto imparfait
- signaux de fragilite, mais pas la cause racine

## Cause racine la plus probable

Ordre de probabilite:

1. Connectivite instable entre le VPS et Supabase
2. Adapter auth qui traite une erreur reseau comme une absence de donnees
3. Couplage trop fort entre session WhatsApp et sync DB
4. Trop d'initialisations d'agents en parallele au boot
5. Realtime sans vrai mecanisme de resubscribe

## Plan d'action par fichier

### 1. `src/lib/whatsapp/supabase-auth.js`

Objectif:

- separer `not_found` de `network_error`

Changements prevus:

- faire retourner a `readData()` une structure explicite:
  - `ok: true, value`
  - `ok: false, kind: 'network' | 'db' | 'not_found'`
- ne plus faire `initAuthCreds()` si la lecture a echoue pour cause reseau
- ajouter retries courts avec backoff sur lecture / ecriture
- journaliser les erreurs reseau comme transitoires

Effet attendu:

- plus de recreation silencieuse de sessions
- moins de QR inutiles

### 2. `src/lib/whatsapp/handlers/session.js`

Objectif:

- ne plus tuer une bonne socket pour un probleme DB temporaire

Changements prevus:

- si l'update DB `connected` echoue:
  - garder la socket ouverte
  - marquer une sync DB en attente
  - relancer un retry asynchrone
- si la sauvegarde du QR echoue:
  - conserver l'etat local
  - reessayer l'update DB sans reinitialiser la session
- ajouter un cooldown par agent avant nouvelle init
- filtrer plus tot les messages `status@broadcast` / `@broadcast`

Effet attendu:

- moins de deconnexions artificielles
- moins de boucles QR

### 3. `whatsapp-service.js`

Objectif:

- reduire la saturation et le bruit

Changements prevus:

- limiter le nombre d'`initSession()` simultanees au boot
- ajouter un anti-spam de logs pour `checkAgents()`
- ne retravailler que les agents dont l'etat a change ou dont le cooldown a expire

Effet attendu:

- moins de pression reseau
- moins de logs repetitifs

### 4. `src/lib/whatsapp/realtime/listeners.js`

Objectif:

- rendre Realtime auto-recouvrant

Changements prevus:

- sur `TIMED_OUT`, `CLOSED`, `CHANNEL_ERROR`:
  - cleanup du canal courant
  - recreation du channel apres backoff
- garde pour eviter plusieurs channels concurrents
- conserver le polling adaptatif comme filet de securite

Effet attendu:

- Realtime qui revient seul apres coupure

### 5. `src/lib/whatsapp/services/media.service.js`

Objectif:

- traiter proprement les medias incomplets

Changements prevus:

- verifier `mediaKey` avant tentative de download
- distinguer warning media invalide / erreur reelle
- retourner `null` proprement sans stack lourde pour les cas non exploitables

Effet attendu:

- moins de bruit
- logs utiles

### 6. Harmonisation JS / TS

Contexte:

- `src/lib/whatsapp/baileys.ts` contient deja certaines gardes utiles
- le service PM2 semble utiliser surtout la pile JS

Changements prevus:

- synchroniser les regles critiques entre `baileys.ts` et `handlers/session.js`
- eviter deux comportements differents en prod

Effet attendu:

- comportement plus coherent

## Ordre d'execution recommande

1. `supabase-auth.js`
2. `handlers/session.js`
3. `whatsapp-service.js`
4. `realtime/listeners.js`
5. `media.service.js`
6. harmonisation JS / TS

## Criteres de validation

### Validation fonctionnelle

- un timeout Supabase ne cree plus de nouveaux creds
- une erreur DB n'interrompt plus une session deja ouverte
- un agent en `qr_ready` ne regenere pas son QR en boucle
- Realtime se reconnecte seul apres fermeture du channel
- les images invalides ne polluent plus les logs

### Validation logs

Les logs doivent fortement diminuer sur:

- `Failed to read key creds`
- `Failed to save QR to DB`
- `QR code generated, saving to DB...` en boucle
- `No session found to decrypt message` pour les broadcasts
- `Image processing failed` sans contexte utile

### Validation ops

- nombre de sessions stables apres restart PM2
- moins de churn dans `qr_ready`
- moins de rescans utilisateurs

## Risques et garde-fous

- Ne pas casser les sessions existantes pendant la correction
- Ne pas supprimer automatiquement des creds sur simple timeout reseau
- Ne pas desactiver le polling tant que Realtime n'est pas auto-recouvrant
- Traiter les erreurs reseau comme transitoires, pas comme etat final

## Decision

Priorite immediate:

- stabiliser la couche auth / Supabase

Priorite suivante:

- decoupler DB et socket

Priorite ensuite:

- durcir Realtime et le traitement media


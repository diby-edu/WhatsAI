# Audit Admin Modules - 2026-03-13

## Perimetre

Audit du code sur les points suivants :

1. Statuts des agents dans le dashboard admin
2. Utilite et limites du module Conversations admin
3. Fiabilite du module Diagnostics
4. Fiabilite du module Analytics
5. Implementation reelle du taux de commission de reversement
6. Utilite reelle des onglets Securite et Intelligence Artificielle
7. Capacite actuelle du systeme a alerter sur les dysfonctionnements

Contrainte respectee :
- aucune modification fonctionnelle du code
- constats bases sur lecture directe des fichiers sources

---

## Resume executif

Le back-office admin existe, mais plusieurs modules melangent :

- donnees reelles
- donnees partielles
- ecrans de configuration non branches
- indicateurs visuellement rassurants mais techniquement incomplets

Les ecarts les plus importants sont :

1. Le statut agent affiche `Actif` meme quand WhatsApp est deconnecte ou en attente de QR.
2. Le taux de commission de reversement est implemente cote payout, mais l'onglet Parametres ne met pas a jour la bonne cle.
3. Le module Diagnostics n'est pas fiable a 100 pourcent : plusieurs routes font un controle d'acces fragile et plusieurs checks sont superficiels ou trompeurs.
4. Le module Analytics n'est pas mathematiquement fiable sur les longues periodes.
5. Les onglets Securite et IA sont en grande partie des ecrans de stockage de parametres, pas des reglages reellement appliques dans le runtime.

---

## Audit priorise

### 1. Eleve - Statut agent admin trompeur

**Constat**

Dans le dashboard admin, le badge principal de la carte agent est base uniquement sur `is_active`, pas sur l'etat operationnel WhatsApp.

**Preuves code**

- Mapping de statut :
  - `src/app/[locale]/admin/agents/page.tsx:25-32`
- Badge principal `Actif/Pause` :
  - `src/app/[locale]/admin/agents/page.tsx:188-194`
- Statut WhatsApp separe (`Connecte`, `A reconnecter`, `QR a scanner`) :
  - `src/app/[locale]/admin/agents/page.tsx:197-215`
- Toggle admin ne change que `is_active` :
  - `src/app/api/admin/agents/[id]/route.ts:85-103`
- Deconnexion WhatsApp est un autre flux :
  - `src/app/api/admin/agents/[id]/route.ts:105-120`

**Impact**

- Un agent inutilisable peut etre percu comme actif.
- Le compteur des agents actifs est faux au sens metier.
- Risque de mauvaise supervision cote support/admin.

**Conclusion**

Le code melange deux notions distinctes :

- activation metier : `is_active`
- etat de connexion WhatsApp : `whatsapp_connected` / `whatsapp_status` / `whatsapp_phone`

**Correction recommandee**

- afficher deux etats distincts :
  - `Automatisation : Active / En pause`
  - `WhatsApp : Connecte / QR a scanner / A reconnecter`
- ne plus utiliser `Actif` comme badge unique de sante operationnelle
- corriger aussi le compteur d'en-tete pour differencier :
  - agents actifs
  - agents connectes

**Priorite**

P1

---

### 2. Eleve - Taux de commission reversement mal branche

**Constat**

Le systeme de payout lit la cle `default_commission_rate`, mais la page admin Parametres modifie `defaultCommissionRate`.

**Preuves code**

- Valeur editee dans l'UI :
  - `src/app/[locale]/admin/settings/page.tsx:208-213`
  - `src/app/[locale]/admin/settings/page.tsx:610-630`
- Sauvegarde brute des cles recues :
  - `src/app/api/admin/settings/route.ts:68-84`
- Cle reellement lue lors de la creation d'un payout :
  - `src/app/api/admin/payouts/route.ts:144-153`
- Cle initialisee en base :
  - `supabase/migrations/20260221_global_settings.sql:13-16`

**Impact**

- Le champ visible dans l'admin peut donner l'impression de piloter le calcul.
- En pratique, le calcul peut continuer avec l'ancienne valeur.
- Risque financier et risque de mauvaise confiance dans l'interface admin.

**Conclusion**

Le mecanisme de commission existe cote payout, mais l'interface de configuration n'est pas reliee a la bonne cle.

**Correction recommandee**

- unifier le nom de cle entre UI et backend
- interdire les doublons camelCase/snake_case pour `app_settings`
- ajouter un test d'integration :
  - changer la valeur dans Parametres
  - creer un payout
  - verifier que le calcul prend bien la nouvelle valeur

**Priorite**

P1

---

### 3. Eleve - Module Diagnostics non fiable a 100 pourcent

**Constat principal**

Plusieurs routes diagnostics font un controle d'acces sur `secUser.role`, alors que `getAuthUser()` renvoie l'utilisateur Supabase Auth et pas le role DB `profiles.role`.

**Preuves code**

- `getAuthUser()` :
  - `src/lib/api-utils.ts:60-67`
- Exemples de routes fragiles :
  - `src/app/api/admin/diagnostics/health/route.ts:10-15`
  - `src/app/api/admin/diagnostics/openai/route.ts:5-10`
  - `src/app/api/admin/diagnostics/env/route.ts:16-21`
  - `src/app/api/admin/diagnostics/security/route.ts:7-12`
  - `src/app/api/admin/diagnostics/smtp/route.ts:5-10`
  - `src/app/api/admin/diagnostics/whatsapp/route.ts:2-7`
  - `src/app/api/admin/diagnostics/whatsapp-service/route.ts:5-10`
  - `src/app/api/admin/diagnostics/integrity/route.ts:5-10`
  - `src/app/api/admin/diagnostics/ratelimit/route.ts:7-12`

**Autres problemes de veracite**

#### 3.1 Health API trop superficielle

- `src/app/api/health/route.ts:3-8`

Cette route repond toujours `healthy` avec un timestamp et une version. Elle ne teste ni :

- base de donnees
- Redis
- OpenAI
- CinetPay
- service WhatsApp

#### 3.2 Test CinetPay trompeur

- `src/app/[locale]/admin/diagnostics/page.tsx:208-224`

Le check considere que si la route repond autrement qu'un `500`, alors l'API est "configuree". Ce n'est pas un vrai test d'integration.

#### 3.3 Check WhatsApp webhook faux

- `src/app/[locale]/admin/diagnostics/page.tsx:290-307`

La page teste `/api/whatsapp/webhook`, alors que l'arborescence API expose seulement :

- `src/app/api/whatsapp/connect/route.ts`
- `src/app/api/whatsapp/send/route.ts`

Il n'existe pas de route `src/app/api/whatsapp/webhook/route.ts`.

#### 3.4 Fallbacks trop optimistes

Exemples :

- variables d'environnement -> fallback "OK"
  - `src/app/[locale]/admin/diagnostics/page.tsx:403-424`
- securite -> fallback "Verification locale OK"
  - `src/app/[locale]/admin/diagnostics/page.tsx:594-627`
- DNS -> fallback "Verification locale OK"
  - `src/app/[locale]/admin/diagnostics/page.tsx:769-801`

Ces fallbacks peuvent rassurer alors que le check a echoue.

#### 3.5 SMTP partiellement faux

- check base sur `process.env`
  - `src/app/api/admin/diagnostics/smtp/route.ts:23-55`
- test d'envoi non implemente
  - `src/app/api/admin/diagnostics/smtp/route.ts:58-85`

Alors que certains flux admin utilisent aussi des valeurs `app_settings` pour le broadcast email :

- `src/app/api/admin/broadcasts/email/route.ts:15-24`

**Impact**

- Un admin peut croire qu'un composant est sain alors qu'il ne l'est pas.
- Impossible d'utiliser Diagnostics comme source de verite production.
- Risque de faux positifs et faux negatifs.

**Correction recommandee**

- unifier l'autorisation admin sur lecture de `profiles.role`
- remplacer les checks "optimistes" par des checks verifiables
- supprimer tout fallback "OK" en cas d'echec de test
- distinguer :
  - configuration detectee
  - connectivite verifiee
  - transaction/test reussi

**Priorite**

P1

---

### 4. Eleve - Analytics faux ou incomplets sur les longues periodes

**Constat**

Le module Analytics repose sur des vues SQL limitees a 30 jours, mais l'UI propose aussi `90d` et `12m`.

**Preuves code**

- API analytics :
  - `src/app/api/admin/analytics/route.ts:25-101`
- Vue revenus limitee a 30 jours :
  - `supabase/migrations/20260220_audit_and_analytics.sql:30-42`
- Vue croissance utilisateurs limitee a 30 jours :
  - `supabase/migrations/20260220_audit_and_analytics.sql:44-53`
- UI propose 7d, 30d, 90d, 12m :
  - `src/app/[locale]/admin/analytics/page.tsx:41-47`
  - `src/app/[locale]/admin/analytics/page.tsx:127-145`

**Probleme critique sur la serie messages**

Pour `7d`, la route utilise une fonction SQL correcte :

- `supabase/migrations/20260115_monitoring_views.sql:77-88`
- `src/app/api/admin/analytics/route.ts:73-76`

Mais pour les periodes plus longues, la route regroupe les messages par **jour de semaine** :

- `src/app/api/admin/analytics/route.ts:77-92`

Donc sur 30 jours ou 90 jours :

- tous les lundis sont fusionnes
- tous les mardis sont fusionnes
- etc.

Ce n'est pas une vraie serie temporelle.

**Autres incoherences**

- le type `14d` existe mais n'est pas propose dans les boutons UI
  - `src/app/[locale]/admin/analytics/page.tsx:15`
  - `src/app/[locale]/admin/analytics/page.tsx:127`
- le bloc messages affiche toujours "7 jours"
  - `src/app/[locale]/admin/analytics/page.tsx:322`

**Impact**

- Les courbes 90d et 12m ne peuvent pas etre considerees comme fiables.
- Les decisions basees sur l'evolution long terme peuvent etre fausses.

**Correction recommandee**

- creer de vraies vues journaliere/hebdomadaire/mensuelle sans limite a 30 jours
- ne jamais grouper par nom de jour de semaine pour une analyse multi-semaines
- aligner le libelle UI avec la periode reelle

**Priorite**

P1

---

### 5. Moyen - Module Conversations admin utile, mais limite

**Constat**

Le module Conversations admin existe et lit bien les conversations des utilisateurs, mais il ne permet pas de consulter tout le thread.

**Preuves code**

- Page admin conversations :
  - `src/app/[locale]/admin/conversations/page.tsx:20-155`
- API admin conversations :
  - `src/app/api/admin/conversations/route.ts:24-68`

La page affiche seulement :

- contact
- agent
- nombre de messages
- dernier message
- date

Elle n'ouvre pas une page de detail de conversation et je n'ai pas trouve de route admin de lecture complete du thread.

**Impact**

- Utilite actuelle : supervision, triage, controle d'activite
- Limite : impossible de lire la conversation complete depuis l'admin

**Sur l'encombrement base de donnees**

Le module lui-meme n'encombre pas la base. Il ne fait que lire :

- `conversations`
- `messages`

Le vrai sujet est la retention des messages. Je n'ai pas trouve de mecanisme clair de purge ou d'archivage des messages dans le code analyse.

**Probleme de performance**

L'API fait un N+1 :

- 1 requete pour la liste des conversations
- puis 2 requetes par conversation :
  - count messages
  - last message

Voir :
- `src/app/api/admin/conversations/route.ts:43-66`

**Correction recommandee**

- decider si l'admin doit avoir :
  - simple supervision
  - ou lecture complete du thread
- si lecture complete :
  - ajouter une page detail
  - paginer les messages
- corriger le N+1 par vue SQL ou requete agregee
- definir une politique de retention/archivage des messages

**Priorite**

P2

---

### 6. Moyen - Onglets Securite et IA surtout cosmetiques

**Constat**

Les valeurs sont bien affichees et sauvegardees dans `app_settings`, mais je n'ai pas trouve de consommation runtime claire pour la plupart des champs.

**Preuves code**

- valeurs presentes dans la page :
  - `src/app/[locale]/admin/settings/page.tsx:191-232`
- sauvegarde brute dans `app_settings` :
  - `src/app/api/admin/settings/route.ts:68-84`
- recherche d'usage hors page settings :
  - pas de consommation metier claire pour :
    - `maintenanceMode`
    - `allowRegistrations`
    - `defaultCredits`
    - `openaiModel`
    - `maxTokensPerMessage`
    - `temperatureDefault`
    - `maxAgentsFree`
    - `maxAgentsStarter`
    - `maxAgentsPro`
    - `maxAgentsBusiness`
    - `sessionTimeout`
    - `maxLoginAttempts`
    - `requireEmailVerification`
    - `enable2FA`
    - `apiRateLimit`
    - `enableMetrics`
    - `logLevel`

**Boutons non branches**

- `Reinitialiser toutes les sessions`
  - `src/app/[locale]/admin/settings/page.tsx:817-831`
- `Purger les logs`
  - `src/app/[locale]/admin/settings/page.tsx:894-908`

Ces boutons n'ont pas de handler visible.

**Nuances**

- Les preferences de notifications admin sont reelles :
  - `src/app/api/admin/notification-preferences/route.ts`
- Une partie des settings email sert au broadcast email :
  - `src/app/api/admin/broadcasts/email/route.ts:15-24`

Mais la plupart des autres services email lisent encore les variables d'environnement :

- `src/lib/notifications/admin-notify.ts:58-68`
- `src/lib/notifications/cron.service.ts:20-30`
- `src/lib/notifications/email.service.ts:8-18`

**Impact**

- L'admin peut penser piloter le systeme alors qu'il ne fait que sauvegarder des valeurs.
- Risque de dette produit et de confusion support.

**Correction recommandee**

- pour chaque champ :
  - soit le brancher reellement au runtime
  - soit le retirer de l'UI
- ne garder visibles que les parametres effectivement operants

**Priorite**

P2

---

### 7. Moyen - Systeme d'alerte existant, mais pas encore un vrai monitoring complet

**Constat**

Il existe deja une base technique pour notifier les admins en cas de probleme, mais ce n'est pas encore un systeme centralise de detection de dysfonctionnement.

**Preuves code**

- service d'envoi admin :
  - `src/lib/notifications/admin-notify.ts:244-304`
- persistance dans `admin_notifications` :
  - `src/lib/notifications/admin-notify.ts:264-272`
- module d'alertes admin :
  - `src/app/api/admin/alerts/route.ts:25-56`
- vue SQL conditionnelle :
  - `supabase/migrations/20260115_monitoring_views.sql:13-62`
- detection WhatsApp down dans cron :
  - `src/lib/notifications/cron.service.ts`
- event `agent_disconnected` emis par le bot :
  - `src/lib/whatsapp/handlers/session.js:266`

**Ce qui existe deja**

- paiements echoues
- agent deconnecte
- erreur OpenAI
- WhatsApp down
- high error rate
- escalade

**Ce qui manque encore**

- une source de verite unique de sante systeme
- un moteur de checks planifies sur tous les composants critiques
- une gestion d'etat d'incident :
  - `new`
  - `ongoing`
  - `resolved`
  - `acked`
- une deduplication d'alertes
- une severite fiable basee sur symptomes reels
- une correlation entre Diagnostic, Alerts et Analytics

**Limite actuelle importante**

La vue `view_admin_alerts` classe tous les agents `whatsapp_connected = false` comme critiques :

- `supabase/migrations/20260115_monitoring_views.sql:13-23`

Cela ne fait pas la difference entre :

- agent volontairement deconnecte
- agent en pause
- agent jamais connecte
- agent vraiment incident

**Correction recommandee**

- creer un vrai module "Health & Alerting"
- emettre des alertes sur transitions d'etat, pas sur simple lecture brute d'un flag
- connecter les checks infra et metier :
  - DB
  - OpenAI
  - CinetPay
  - WhatsApp bot
  - files d'attente
  - Redis
  - webhooks

**Priorite**

P2

---

## Ce qui est vrai aujourd'hui, module par module

### Dashboard admin > Agents

- Oui, l'admin peut mettre un agent en pause ou l'activer
- Non, le badge principal ne represente pas fidelement l'etat operationnel
- Oui, il faut un autre libelle pour les agents a QR ou a reconnecter

### Dashboard admin > Conversations

- Oui, l'admin voit les conversations utilisateurs au niveau resume
- Non, il ne lit pas aujourd'hui le thread complet
- Non, le module n'encombre pas la base a lui seul
- Oui, la volumetrie messages doit etre geree par retention/archivage

### Dashboard admin > Diagnostics

- Non, toutes les donnees ne sont pas garanties vraies aujourd'hui
- Oui, certaines verifications sont utiles
- Non, le module n'est pas encore une source de verite production

### Dashboard admin > Analytics

- Oui, certaines donnees sont reelles
- Non, les periodes longues ne sont pas fiables en l'etat
- Non, le volume messages multi-semaines n'est pas correctement calcule

### Dashboard admin > Parametres > Paiement

- Oui, la commission existe dans le calcul payout
- Non, le champ admin n'alimente pas correctement la cle lue par le backend

### Dashboard admin > Parametres > IA / Securite

- Oui, l'UI existe
- Non, la plupart des reglages ne pilotent pas encore le runtime

### Dysfonctionnements et alertes

- Oui, une base d'alerting existe deja
- Non, ce n'est pas encore un monitoring complet et fiable

---

## Roadmap de correction recommandee

### Sprint 1 - Verite de l'admin

1. Corriger les badges et compteurs du module Agents
2. Unifier la cle de commission `default_commission_rate`
3. Corriger l'autorisation des routes diagnostics
4. Supprimer les checks diagnostics trompeurs ou faux

### Sprint 2 - Verite des donnees

1. Refaire les vues analytics pour 30d, 90d, 12m
2. Corriger la serie messages par vraies dates
3. Clarifier les checks CinetPay, WhatsApp, SMTP, health

### Sprint 3 - Capacite d'exploitation

1. Decider si Conversations admin doit afficher le thread complet
2. Ajouter une retention/archivage des messages
3. Construire un vrai module d'alerting centralise

### Sprint 4 - Nettoyage produit

1. Brancher reellement les settings utiles
2. Retirer les settings cosmetiques
3. Ajouter des tests d'integration admin

---

## Decision recommandees avant implementation

1. Valider la nomenclature des statuts agents
2. Choisir si l'admin peut lire le thread complet ou seulement superviser
3. Decider quels settings admin doivent vraiment piloter le runtime
4. Definir les alertes critiques qui doivent declencher :
   - notification in-app
   - push
   - email

---

## Verdict final

Le back-office admin est exploitable, mais il ne faut pas encore le considerer comme totalement fiable pour la supervision technique ou le pilotage global.

Les deux corrections les plus urgentes avant toute extension sont :

1. remettre la verite dans les statuts agents
2. remettre la verite dans Diagnostics / Analytics / Settings critiques


# Audit Responsivite Dashboards (Admin + Utilisateur)

Date: 2026-03-02
Contexte: audit complet des pages et modules des 2 dashboards, en local sur `http://localhost:3100`.
Perimetre:
- Dashboard admin: 20 routes
- Dashboard utilisateur: 13 routes
- Breakpoints testes: mobile 375x812, tablet 768x1024, desktop 1440x900

Methodologie:
1. Login reel avec vos 2 comptes.
2. Navigation automatique Playwright sur chaque route x chaque viewport.
3. Mesure de:
   - `docW > vw` (overflow horizontal global)
   - elements visibles qui depassent a droite (`offenders`)
   - pages qui timeout en `waitUntil: networkidle`
4. Validation visuelle avec captures dans `output/playwright/responsive-audit/`.

## Etat apres correction (2026-03-02)

Correctifs implémentés:
- durcissement layout principal admin/user (`minWidth: 0`, `width: 100%`, controle overflow)
- harmonisation responsive des pages admin critiques (users, settings, subscriptions, bookings, orders, payments, credit-packs, conversations, audit-logs, analytics)
- normalisation responsive wizard creation agent (stepper, grilles, horaires, navigation)
- correction conversation user pour messages longs (shrink + wrapping)

Validation post-correction (Playwright):
- Dashboard admin complet (20 routes x 3 viewports = 60 checks):
  - `errors: 0`
  - `clips: 0`
  - `overflow: 0`
- Dashboard user complet (13 routes x 3 viewports = 39 checks):
  - `errors: 0`
  - `clips: 0`
  - `overflow: 0`

Note test:
- l'audit final utilise `waitUntil: domcontentloaded` au lieu de `networkidle` pour eviter les faux positifs sur pages avec activite reseau continue (diagnostics/notifications).

---

## 1) Resume executif

### Chiffres globaux
- Admin: 60 combinaisons (20 routes x 3 viewports)
  - `errorCount = 3` (les 3 sur `/fr/admin/diagnostics`)
  - `overflowCount = 0` (pas de scroll horizontal global)
  - `clipCount = 14` (contenu visible hors viewport sur certaines pages)
- Utilisateur: 39 combinaisons (13 routes x 3 viewports)
  - `errorCount = 3` (les 3 sur `/fr/dashboard/notifications`)
  - `overflowCount = 0`
  - `clipCount = 3`

### Point cle
Le probleme principal n est pas un overflow global de la page (`docW == vw`), mais des blocs internes plus larges que le viewport. Comme certains conteneurs/layouts masquent l overflow, le contenu est coupe visuellement au lieu d etre vraiment responsive.

---

## 2) Audit priorise (Risque eleve -> faible)

## Critique A - Pages admin data-heavy non adaptatives en mobile/tablet

Probleme observe:
- Plusieurs modules admin restent structures desktop-first (tables/headers trop larges).
- En mobile/tablet, une partie du contenu est hors viewport.

Impact metier:
- Lecture partielle des infos (colonnes coupees)
- Actions admin plus lentes / erreurs de manipulation
- UX degradee pour admin sur telephone/tablette

Preuves de mesure (bodyW > vw):
- `/fr/admin/users` mobile+tablet: `1026 > 375/768`
- `/fr/admin/settings` mobile+tablet: `924 > 375/768`
- `/fr/admin/subscriptions` mobile+tablet: `774 > 375/768`
- `/fr/admin/conversations` mobile: `709 > 375`
- `/fr/admin/bookings` mobile: `666 > 375`
- `/fr/admin/payments` mobile: `657 > 375`
- `/fr/admin/orders` mobile: `626 > 375`
- `/fr/admin/credit-packs` mobile: `574 > 375`

Causes techniques confirmees dans le code:
- Tables avec largeur minimale fixe:
  - `src/app/[locale]/admin/users/page.tsx:166` (`minWidth: 1000`)
  - `src/app/[locale]/admin/subscriptions/page.tsx:174` (`minWidth: 700`)
  - `src/app/[locale]/admin/payments/page.tsx:397` (`minWidth: 550`)
  - `src/app/[locale]/admin/orders/page.tsx:226` (`minWidth: 600`)
  - `src/app/[locale]/admin/bookings/page.tsx:207` (`minWidth: 580`)
  - `src/app/[locale]/admin/conversations/page.tsx:51` (`minWidth: 550`)
  - `src/app/[locale]/admin/credit-packs/page.tsx:289` (`minWidth: 500`)
- Grille logs non responsive:
  - `src/app/[locale]/admin/audit-logs/page.tsx:121` et `:144`
  - `gridTemplateColumns: '1.5fr 1.5fr 1fr 2fr 1.2fr'`

Plan de resolution detaille:
1. Definir une strategie par breakpoint:
   - `< 768px`: layout cartes (plus de table 7+ colonnes)
   - `>= 768px`: table possible, mais scroll horizontal explicite et utilisable
2. Pour chaque page table admin:
   - garder table desktop
   - ajouter rendu mobile dedie (cards avec champs prioritaires)
   - conserver actions via menu contextuel (Edit/Delete/View)
3. Ajouter des utilitaires communs:
   - composant `ResponsiveDataList`
   - props: `columns`, `mobileFields`, `actions`
4. Standardiser l ergonomie:
   - cibles tactiles >= 44px
   - texte critique jamais tronque sans tooltip
   - badges statut sur ligne separee en mobile

Definition of Done:
- Aucune colonne critique coupee en 375px
- Toutes les actions admin majeures faisables sans zoom/scroll horizontal force
- Validation screenshot mobile/tablet/desktop par page

---

## Eleve B - Page admin Settings cassable en petit ecran

Probleme observe:
- Header et sections internes poussent la largeur totale hors viewport.
- Le contenu apparait coupe en mobile/tablet.

Impact:
- Parametrage global difficile depuis mobile
- Risque de mauvaise saisie (champs non visibles)

Causes dans le code:
- Conteneur root:
  - `src/app/[locale]/admin/settings/page.tsx:1020` (`maxWidth: 900` sans `width: '100%'`)
- Header sans wrap:
  - `:1022` (`display: flex; justifyContent: space-between`)
- Plusieurs sections en 2 colonnes fixes:
  - `:416`, `:543`, `:699` (`gridTemplateColumns: '1fr 1fr'`)
- Champs largeur fixe:
  - `:378`, `:598`, `:828` (`width: 150`)

Plan de resolution detaille:
1. Root container:
   - imposer `width: '100%'`, `maxWidth: 900`, `margin: '0 auto'`
2. Header:
   - `flexWrap: 'wrap'` en mobile
   - bouton Save pleine largeur sous le titre en mobile
3. Grilles:
   - passer en `1fr` sous 768px
4. Inputs fixes:
   - remplacer `width: 150` par `width: '100%'` avec `maxWidth` si necessaire
5. Tabs:
   - garder `overflowX: auto`, ajouter indicateur visuel de scroll

Definition of Done:
- Aucune section settings coupee a 375px
- Toutes les options accessibles sans zoom

---

## Eleve C - Wizard "Nouvel agent": debordement horizontal de composants fixes

Probleme observe:
- Debordement detecte en mobile sur `/fr/dashboard/agents/new`.

Impact:
- Etapes peu lisibles en debut de flow
- Risque d abandon de creation agent

Causes techniques:
- Stepper horizontal dimensions fixes:
  - `src/app/[locale]/dashboard/agents/new/page.tsx:1491-1520`
  - cercles `width: 40` + connecteurs `width: 40` sans `flexWrap`
- Lignes horaires avec largeurs fixes:
  - `:775` (`width: 100` label jour)
  - `:795` et `:805` (`width: 100` inputs heure)
  - `:809` (`width: 216` etat "Ferme")
- Plusieurs blocs 2 colonnes fixes:
  - `:671`, `:699`, `:875`, `:1188`, `:1214`

Plan de resolution detaille:
1. Stepper mobile:
   - option A: passer en stepper vertical
   - option B: garder horizontal mais 1) reducer, 2) cacher connecteurs, 3) scroll snap
2. Horaires:
   - basculer en stack vertical en mobile
   - supprimer largeurs fixes, utiliser `%`/`minmax`
3. Grilles formulaire:
   - media query: `1fr` sous 768px
4. QA UX:
   - verifier flow complet (step 1 a step 7) en mobile reel

Definition of Done:
- Flow creation agent complet possible en 375px sans coupure

---

## Eleve D - Conversations user: messages longs cassent la mise en page

Probleme observe:
- Offenders enormes sur tablet/desktop (`width` > 1600 et > 4000) sur `/fr/dashboard/conversations`.

Impact:
- Texte et cards se comportent de facon instable
- Troncature non maitrisee selon contenu reel

Causes techniques:
- Container flex sans contrainte de shrink:
  - `src/app/[locale]/dashboard/conversations/page.tsx:248` (`<div style={{ flex: 1 }}>`)
- Texte force en une seule ligne:
  - `:262` (`whiteSpace: 'nowrap'`, `overflow: 'hidden'`, `textOverflow: 'ellipsis'`)
- Avec des messages tres longs/non cassables, le flex item refuse de retrecir (pas de `minWidth: 0`).

Plan de resolution detaille:
1. Ajouter `minWidth: 0` sur le bloc flex contenant le message
2. Garder ellipsis mais ajouter:
   - `overflowWrap: 'anywhere'` ou `wordBreak: 'break-word'` selon rendu voulu
3. Limiter strictement la zone texte:
   - `maxWidth: '100%'`
4. Ajouter tooltip/detail au clic pour lire le message complet

Definition of Done:
- Aucun offender > viewport sur conversations tablet/desktop
- Messages longs restent lisibles/controles sans casser la card

---

## Moyen E - Dashboard layout masque les debordements au lieu de les traiter

Probleme observe:
- Le layout user masque l overflow horizontal global.

Impact:
- Les erreurs de layout peuvent etre invisibles mais presentes
- Contenu potentiellement coupe sans feedback utilisateur

Cause:
- `src/app/[locale]/dashboard/layout.tsx:740` (`overflowX: 'hidden'`)

Plan de resolution detaille:
1. Garder `overflowX: hidden` seulement si tous les modules enfants sont guarantees responsive
2. Sinon:
   - retirer ce masquage
   - corriger les modules qui debordent a la source
3. Ajouter controle visuel en QA (check `offenders.length === 0`)

---

## Moyen F - Faux positifs / timeout `networkidle` sur 2 routes

Probleme observe:
- Timeouts Playwright `waitUntil: networkidle`:
  - `/fr/admin/diagnostics` (3/3 breakpoints)
  - `/fr/dashboard/notifications` (3/3 breakpoints)

Impact:
- Les tests E2E paraissent en echec alors que la page peut etre visuellement chargee.
- Signe possible de trafic reseau continu non maitrise.

Cause probable:
- Diagnostics fait de nombreux fetchs de verification en chaine.
- Notifications charge Supabase + preferences; `networkidle` peut rester non atteint selon requetes actives.

Plan de resolution detaille:
1. Cote test:
   - remplacer `waitUntil: 'networkidle'` par `domcontentloaded` + attente de selecteurs stables
2. Cote app:
   - paralleliser/encadrer les fetchs de diagnostics
   - introduire timeout/abort controller sur checks externes

---

## Faible G - Debordement visuel decoratif en analytics

Probleme observe:
- Elements decoratifs hors viewport de quelques pixels sur analytics.

Cause:
- `src/app/[locale]/admin/analytics/page.tsx:203` (`right: -20`) et `:204` (`width: 100`)

Impact:
- Faible (visuel), mais pollue les audits automatiques.

Plan:
- Soit recadrer ces blobs, soit les ignorer explicitement dans la metrique QA.

---

## 3) Plan d execution concret

## Sprint 1 (priorite haute, 3-4 jours)
Objectif: eliminer les coupures visibles les plus critiques.
- Corriger `dashboard/agents/new` (stepper + horaires + grilles)
- Corriger `dashboard/conversations` (minWidth:0 + wrapping)
- Corriger `admin/settings` (header + grilles + widths fixes)
- Adapter tests E2E pour ne plus dependre de `networkidle`

Livrable:
- 0 coupure majeure sur les 3 pages critiques en mobile/tablet

## Sprint 2 (priorite haute, 4-5 jours)
Objectif: rendre les pages admin tabulaires utilisables sur mobile.
- `admin/users`, `subscriptions`, `payments`, `orders`, `bookings`, `credit-packs`, `conversations`, `audit-logs`
- Introduire pattern commun responsive table -> cards mobile

Livrable:
- Toutes actions admin principales realisables sur mobile sans zoom

## Sprint 3 (stabilisation, 2-3 jours)
Objectif: prevenir les regressions.
- Ajout script QA responsive CI (meme 3 breakpoints)
- Seuils d alerte:
  - `overflowCount = 0`
  - `clipCount = 0` (hors exceptions decoratives explicitement whitelist)
- Baseline screenshots versionnee

Livrable:
- Gate de qualite responsive en pre-deploiement

---

## 4) Conclusion claire

Ce qui ne va pas:
- Plusieurs ecrans restent concus desktop-first avec contraintes fixes (tables/grilles/largeurs), donc contenu coupe en mobile/tablet.

Pourquoi c est un probleme:
- L admin perd de la lisibilite, donc plus d erreurs operationnelles.
- Le user flow creation agent est fragilise sur mobile.
- Les tests automatiques deviennent instables sur certaines pages.

Comment je compte le resoudre:
- Corriger d abord les points de rupture structurels (stepper, flex shrink, grilles fixes, settings).
- Migrer les pages admin tabulaires vers un pattern responsive dual (cards mobile + table desktop).
- Ajouter un garde-fou QA automatise pour empecher toute regression.


# WazzapAI — Stratégie LinkedIn complète

> Document généré le 21 avril 2026 à partir de l'analyse exhaustive du code source.

---

## TABLE DES MATIÈRES

1. [Analyse produit](#1-analyse-produit)
2. [Certain / Probable / À valider](#2-certain--probable--à-valider)
3. [Positionnement recommandé](#3-positionnement-recommandé)
4. [Page LinkedIn](#4-page-linkedin)
5. [Plan de contenu](#5-plan-de-contenu)
6. [Checklist de lancement](#6-checklist-de-lancement)

---

## 1. ANALYSE PRODUIT

### Le produit en une phrase
WazzapAI est une plateforme SaaS qui permet à des entreprises de déployer des agents IA sur WhatsApp pour automatiser les réponses, vendre des produits, prendre des réservations et qualifier des leads — sans compétence technique.

### Problème résolu
Des PME et micro-entreprises reçoivent des centaines de messages WhatsApp par jour, répondent trop lentement ou pas du tout, perdent des ventes et ne peuvent pas se payer un agent humain disponible 24/7.

### Cible principale
PME et micro-entreprises en Afrique (focus Afrique de l'Ouest / francophone), marché global secondaire.
- Devise : XOF (FCFA)
- Paiements locaux : CinetPay, Paystack, Mobile Money
- Prix : Starter 5 000 F · Pro 15 000 F · Business 45 000 F

### Cibles secondaires
- Agences digitales et intégrateurs (programme partenaire)
- Investisseurs tech africaine
- Particuliers entrepreneurs

### 8 verticaux métier (missions prédéfinies dans le code)
1. Restaurants / Fast-food
2. E-commerce / Boutiques
3. Hôtels / Hébergement
4. Salons / Beauté
5. Services / Artisans
6. Support client / Leads
7. Santé / Cliniques
8. Éducation / Formations

### Fonctionnalités majeures (confirmées dans le code)

| # | Fonctionnalité | Fichiers observés |
|---|----------------|-------------------|
| 1 | Agents IA WhatsApp — wizard 5 étapes, connexion QR code ou code 8 chiffres | `/dashboard/agents/new`, composant wizard |
| 2 | Catalogue produits + commandes via WhatsApp (physique, numérique, service) | `/dashboard/products`, `/dashboard/orders` |
| 3 | Réservations et RDV | `/admin/bookings`, table `bookings` |
| 4 | Knowledge base — import texte, PDF, URL (RAG) | `/dashboard/agents/[id]/knowledge` |
| 5 | Lead collection & qualification automatique | `/dashboard/agents/[id]/leads`, table `leads` |
| 6 | Analytics — KPIs, chiffre d'affaires, conversion, ARPU | `/dashboard/analytics`, Recharts |
| 7 | Broadcast WhatsApp/Email/Push (admin) | `/admin/broadcasts` |
| 8 | API + Webhooks + intégrations Shopify/WooCommerce | `/dashboard/developers`, table `api_keys` |
| 9 | Plans + crédits (Free → Starter → Pro → Business → Scale) | `/dashboard/billing` |
| 10 | App mobile native iOS/Android | Capacitor 8, biometric lock |

### Plans tarifaires

| Plan | Prix FCFA | Crédits/mois | Agents |
|------|-----------|--------------|--------|
| Gratuit | 0 | 10 offerts | 1 |
| Starter | 5 000 | 500 | 1 |
| Pro | 15 000 | 2 500 | 3 |
| Business | 45 000 | 8 000 | 6 |
| Scale | Personnalisé | Illimité | Illimité |

> 1 crédit = 1 message envoyé par l'IA.

### Différenciateurs clés
- **Pas d'API Meta officielle** — connexion via Baileys, pas de frais Meta, pas de validation préalable → accessible immédiatement
- **Freemium sans CB** — 10 crédits offerts dès l'inscription
- **Wizard 5 minutes** — aucune compétence technique requise
- **Multi-vertical natif** — missions prédéfinies (restaurant, e-commerce, beauté, etc.)
- **Système de crédits flexible** — pas d'engagement, achat à la demande
- **Full-stack embarqué** — commandes + paiements + analytics + leads dans une seule plateforme
- **App mobile native** — gérer ses conversations depuis le téléphone

---

## 2. CERTAIN / PROBABLE / À VALIDER

### Certain (observé directement dans le code)
- Produit SaaS d'automatisation WhatsApp par IA
- Cible Afrique de l'Ouest (FCFA, CinetPay, Paystack)
- 8 verticaux métier préconfigurés
- Modèle freemium + crédits + abonnements récurrents
- Wizard no-code (5 étapes, moins de 5 minutes)
- Produit mature : 82 migrations SQL, 100+ endpoints, admin panel complet, Sentry, RGPD

### Probable (fortement suggéré mais non confirmé)
- Focus Côte d'Ivoire / Sénégal / Cameroun en priorité (CinetPay implanté principalement CI/SN)
- Cible secondaire : agences digitales / intégrateurs (architecture multi-tenant cohérente)
- Absence de Stripe = positionnement exclusivement Afrique à ce stade

### À valider (le code ne tranche pas)
- Métriques de la landing ("100+ companies", "100k+ messages") — réelles ou objectifs de lancement ?
- Concurrents directs identifiés sur le marché cible
- Canal d'acquisition principal (organique, paid, partenaires)
- Noms des fondateurs / équipe

---

## 3. POSITIONNEMENT RECOMMANDÉ

### Contexte validé
- Marché : Afrique en priorité, monde en général
- Clients actuels : oui, secteur support
- Objectif LinkedIn : clients directs (PME/particuliers) + investisseurs + partenaires
- Positionnement : accessible pour tous
- Audience principale : PME en particulier, tous les autres en général
- Entité : page entreprise "Wazzap AI"

### Proposition de valeur principale
> "Chaque message WhatsApp sans réponse est une vente perdue. WazzapAI répond à votre place, 24h/24 — en 5 minutes d'installation."

### 3 angles de positionnement

**Angle A — L'opportunité africaine**
"WhatsApp est le bureau commercial de l'Afrique. WazzapAI est l'assistant IA qui le rend rentable."
→ Fort pour les investisseurs et partenaires. Affirme le leadership sur un marché sous-équipé.

**Angle B — L'accessibilité universelle**
"L'automatisation WhatsApp par IA n'était réservée qu'aux grandes entreprises. Plus maintenant."
→ Fort pour les PME et particuliers. Démocratise une technologie perçue comme complexe ou chère.

**Angle C — Le moteur de croissance**
"Vos concurrents répondent en 3 heures. Vous répondez en 3 secondes. Devinez qui vend plus."
→ Fort pour les décideurs orientés ROI. Ancre le produit dans la performance business.

### Recommandation : combiner A + C avec B en sous-texte
L'Afrique est le différenciateur géographique crédible (pour les investisseurs). Le ROI immédiat convertit les PME. L'accessibilité rassure les hésitants.

### 5 bénéfices clés
1. **Répond instantanément** — aucun client sans réponse, même la nuit ou le week-end
2. **Vend automatiquement** — commandes, réservations et paiements traités sans intervention humaine
3. **Opérationnel en 5 minutes** — sans développeur, sans validation Meta
4. **Grandit avec l'entreprise** — de 0 à des milliers de conversations, même tarif par message
5. **Tout en un** — agent IA + catalogue + commandes + analytics + leads dans une seule plateforme

---

## 4. PAGE LINKEDIN

### Slogans (du plus clair au plus percutant)
1. "Automatisez WhatsApp. Vendez sans vous arrêter."
2. "Votre meilleur commercial travaille 24h/24 sur WhatsApp — c'est l'IA WazzapAI."
3. "3 secondes pour répondre. 5 minutes pour démarrer. 0 vente perdue."

### Tagline LinkedIn (120 caractères — recommandée)
```
Plateforme IA d'automatisation WhatsApp pour PME | Agents IA · Commandes · Leads · Analytics
```

### Pitch en une phrase
"WazzapAI est la plateforme SaaS qui transforme WhatsApp en assistant IA commercial — pour que chaque PME réponde, vende et fidélise automatiquement, 24h/24."

---

### Section "À propos" — Version 1 (Claire · PME et partenaires)

Chaque jour, des milliers d'entreprises perdent des clients sur WhatsApp. Pas parce qu'elles n'ont pas le bon produit — mais parce qu'elles n'ont pas répondu assez vite.

**WazzapAI résout ce problème.**

Notre plateforme permet à n'importe quelle entreprise de déployer un agent IA sur WhatsApp en moins de 5 minutes. Sans développeur. Sans API officielle Meta. Sans abonnement coûteux.

L'agent répond aux clients, prend les commandes, qualifie les leads et transfère les cas complexes à un humain — automatiquement, 24h/24, 7j/7.

**Ce que font nos clients avec WazzapAI :**
— Restaurants : prise de commandes et réservations automatisées
— E-commerce : catalogue produits, checkout et paiement via WhatsApp
— Services & artisans : devis, RDV et suivi client sans effort
— Support client : qualification de leads et escalade intelligente

Disponible en Afrique et dans le monde. Freemium. Multilingue (FR/EN).

---

### Section "À propos" — Version 2 · RECOMMANDÉE (Narrative investisseur/partenaire)

WhatsApp compte plus de 2 milliards d'utilisateurs. En Afrique, c'est le premier canal de communication commercial — avant l'email, avant le téléphone.

Pourtant, la majorité des PME africaines gèrent encore leurs conversations WhatsApp manuellement. Résultat : réponses tardives, leads perdus, ventes ratées.

**WazzapAI change ça.**

Nous avons construit la première plateforme SaaS full-stack d'automatisation WhatsApp par IA pensée pour les marchés émergents : pricing adapté, intégrations de paiement locales (CinetPay, Paystack, Mobile Money), verticaux métier préconfigurés.

Notre modèle : freemium + crédits à la demande + abonnements récurrents. Notre marché : toute entreprise qui vend ou gère des clients sur WhatsApp.

Nous travaillons avec des PME, des agences digitales et des intégrateurs pour rendre l'IA accessible à tous — pas seulement aux grandes entreprises.

**Partenaires, investisseurs, intégrateurs : parlons.**

---

### Section "À propos" — Version 3 (Percutante · posts de lancement)

Vous avez déjà perdu un client parce que vous n'avez pas répondu à temps sur WhatsApp ?

WazzapAI est fait pour ça.

Un agent IA configuré en 5 minutes. Connecté à votre numéro WhatsApp. Il répond, vend, réserve et qualifie vos leads — pendant que vous faites autre chose.

Restaurants. Boutiques. Salons. Agences. Cliniques. Peu importe votre secteur : si vous avez des clients sur WhatsApp, WazzapAI vous fait gagner du temps et de l'argent.

Afrique d'abord. Monde entier ensuite.

Gratuit pour commencer. Pas de carte bancaire. Pas de code.

---

### Spécialités LinkedIn (à cocher dans les paramètres de la page)
```
Artificial Intelligence
WhatsApp Automation
Conversational AI
SaaS
Small and Medium Businesses
E-commerce
Lead Generation
Customer Support Automation
Chatbots
Africa Tech
Mobile Commerce
API Integration
```

### CTA finaux
1. `Essayez gratuitement — 10 messages IA offerts, sans carte bancaire → [lien site]`
2. `Vous êtes agence ou intégrateur ? Parlons partenariat → [email/lien contact]`
3. `Vous investissez dans la tech africaine ? Découvrez notre traction → [lien ou DM]`

---

## 5. PLAN DE CONTENU

### 10 premiers posts LinkedIn

**Post 1 — Lancement (Jour 1)**
```
On a construit WazzapAI parce qu'on en avait assez de voir des PME perdre des clients sur WhatsApp.
Pas par manque de produit. Par manque de réponse.
Aujourd'hui, on lance. Un agent IA, 5 minutes d'installation, 0 développeur requis.
Lien en commentaire.
```

**Post 2 — Le problème (Jour 3)**
```
Une PME reçoit en moyenne X messages WhatsApp par jour.
Elle en répond à moins de 60% dans l'heure.
Résultat : des clients qui passent à la concurrence.
C'est le problème qu'on résout.
```

**Post 3 — Démo visuelle (Jour 5)**
```
[Vidéo screencast ou GIF : création d'un agent IA en 5 minutes]
De zéro à agent IA WhatsApp en 5 minutes. Sans code. Sans API Meta.
```

**Post 4 — Témoignage client (Jour 8)**
```
Notre premier client utilise WazzapAI pour son service support.
Résultat après [X semaines] : [métrique concrète].
[Citation courte du client si accord]
```

**Post 5 — Use case restaurant (Jour 10)**
```
Un restaurant qui prend ses commandes sur WhatsApp manuellement
perd [X]% de ses commandes le soir et le week-end.

Avec WazzapAI : menu, commande, paiement — tout automatisé.
Aucun humain requis de 20h à 8h.
```

**Post 6 — Use case e-commerce (Jour 13)**
```
Et si votre boutique WhatsApp répondait aux questions produits,
encaissait et confirmait les commandes — même quand vous dormez ?

C'est exactement ce que font nos marchands avec WazzapAI.
```

**Post 7 — L'angle Afrique (Jour 16)**
```
WhatsApp est le premier canal commercial de l'Afrique.
Pourtant, 90% des PME africaines le gèrent encore manuellement.

WazzapAI est construit pour ça :
CinetPay · Paystack · Mobile Money · FCFA · 5 000 F/mois pour démarrer.
```

**Post 8 — Appel partenaires (Jour 19)**
```
Vous êtes agence digitale, intégrateur ou consultant ?

WazzapAI propose un programme partenaire :
revendez la plateforme à vos clients, gardez une marge, déployez en quelques heures.

Écrivez-nous en DM.
```

**Post 9 — Transparence traction (Jour 22)**
```
Voici ce qu'on a construit en [X mois] :
— [X] agents déployés
— [X] messages traités par l'IA
— [X] secteurs couverts

On construit en public. Suite au prochain épisode.
```

**Post 10 — Appel investisseurs (Jour 25)**
```
Le marché SaaS en Afrique croît de X% par an.
WhatsApp couvre 90%+ des smartphones africains.
On a un produit, des clients, un modèle récurrent.

Si vous investissez dans la tech africaine, je veux vous parler.
```

---

### Calendrier éditorial 30 jours

| Semaine | Thème | Format |
|---------|-------|--------|
| S1 · J1–J7 | Lancement + problème + démo | Post texte, vidéo démo, image before/after |
| S2 · J8–J14 | Clients + use cases (restaurant, e-commerce) | Témoignage, carousel use case |
| S3 · J15–J21 | Marché africain + use cases (beauté, services) | Post données marché, carousel fonctionnalités |
| S4 · J22–J30 | Traction + partenaires + investisseurs | Transparence chiffres, appel partenaires, appel investisseurs |

**Rythme** : 3 posts/semaine · lundi, mercredi, vendredi

---

## 6. CHECKLIST DE LANCEMENT

### Page entreprise LinkedIn
- [ ] Créer la page "Wazzap AI" sur LinkedIn
- [ ] Logo haute résolution (fond blanc et fond sombre)
- [ ] Bannière (1128 × 191 px) — visuel produit ou slogan
- [ ] Tagline renseignée (version recommandée ci-dessus)
- [ ] Section "À propos" complète (Version 2 recommandée)
- [ ] Spécialités cochées (liste ci-dessus)
- [ ] URL personnalisée : linkedin.com/company/wazzapai
- [ ] Site web renseigné
- [ ] Secteur : "Technology, Information and Internet"
- [ ] Taille : "2–10 employees"
- [ ] Siège : pays principal

### Contenu avant lancement
- [ ] Post de lancement rédigé et programmé
- [ ] Démo vidéo ou GIF prête (screencast wizard 5 min)
- [ ] 2–3 visuels génériques (fonctionnalités, use case, before/after)
- [ ] Premiers followers invités (réseau perso du fondateur)
- [ ] Page suivie par les comptes perso de l'équipe

### Acquisition
- [ ] Profil LinkedIn fondateur lié à la page entreprise
- [ ] Post personnel du fondateur au lancement (portée x3 vs page seule)
- [ ] 5 groupes LinkedIn identifiés (entrepreneurs Afrique, PME digitales, etc.)
- [ ] Programme partenaire formalisé (une page PDF ou page dédiée)
- [ ] Email de lancement aux premiers clients — demander follow + témoignage

### Tracking
- [ ] Analytics LinkedIn activé
- [ ] UTM sur tous les liens partagés
- [ ] Objectifs définis : X followers en 30 jours · X leads en 30 jours

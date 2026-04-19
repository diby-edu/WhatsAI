# Plan - Agent e-commerce avec `external_sync` sans casser la prod (2026-04-19)

## 1. Objectif

Permettre a un agent `ecommerce` de fonctionner dans deux modes clairs :

- `native`
- `external_sync`

Sans :

- dupliquer la logique e-commerce existante
- casser les agents actuels en production
- introduire des combinaisons ambigues ou difficiles a maintenir

## 2. Decision produit recommandee

Le bon modele V1 n'est pas :

- une nouvelle mission `api`
- ni deux axes de configuration exposes aux clients

Le bon modele V1 est :

- `mission = ecommerce`
- `ecommerce_mode = native | external_sync`

Semantique :

- `native` = catalogue local WazzapAI + tunnel panier/checkout natif WazzapAI
- `external_sync` = catalogue externe synchronise par API + checkout gere par la plateforme externe

Conclusion :

- on garde une seule mission metier `ecommerce`
- on ajoute un seul mode de fonctionnement
- on evite les modes hybrides flous en production

## 3. Pourquoi c'est le bon choix

### Ce qu'il faut eviter

Creer un vrai "agent API" separe serait dangereux si cela oblige a recopier :

- la logique produits
- la logique panier
- la logique checkout
- la logique commande
- la logique paiement

Ce serait une divergence produit couteuse et fragile.

### Ce qu'il faut garder

La logique e-commerce actuelle reste la reference pour tous les agents `native`.

Le mode `external_sync` devient simplement une autre facon d'alimenter et d'orchestrer l'agent.

## 4. Regle de securite production

Ce plan doit etre 100% additif.

Regles absolues :

- aucun agent existant ne change de comportement par defaut
- aucune migration destructive
- aucun changement implicite des agents `ecommerce` actuels
- aucun checkout natif ne doit s'activer pour un agent `external_sync`
- aucun produit local ne doit etre exige pour faire fonctionner `external_sync`

## 5. Modele de donnees minimal recommande

Ajouter sur `public.agents` :

- `ecommerce_mode TEXT NOT NULL DEFAULT 'native'`

Check recommande :

- `ecommerce_mode in ('native', 'external_sync')`

Important :

- tous les agents actuels deviennent implicitement `ecommerce_mode = 'native'`
- donc aucun changement de comportement en prod

## 6. Comportement fonctionnel des deux modes

### Mode `native`

C'est le comportement actuel.

Source de verite :

- produits locaux WazzapAI
- panier local
- checkout local
- commandes locales

### Mode `external_sync`

Source de verite :

- catalogue externe envoye via `/api/public/v1/sync`
- contexte transactionnel envoye via `/api/public/v1/trigger`
- checkout et paiement geres hors de WazzapAI

Regles :

- pas d'ajout manuel de produit pour cet agent
- pas de tunnel panier / checkout natif WazzapAI
- pas de dependance au schema du formulaire produit local
- l'agent repond a partir de :
  - `agent_external_data`
  - la base de connaissance si elle existe
  - `live_query_url` si configure plus tard

## 7. Reponse a votre preoccupation principale

Oui, les produits d'une plateforme externe ne doivent pas dependre de vos champs de creation de produit locaux.

En mode `external_sync` :

- le catalogue vient de la plateforme connectee
- il est pousse par API
- il est stocke cote sync externe
- il n'a pas besoin d'etre recree manuellement dans le formulaire produit WazzapAI

Exemple de source :

- WooCommerce
- Shopify-like
- ERP
- application maison
- n8n / Make qui normalise les produits avant envoi

Exemple de payload produit attendu :

```json
{
  "agent_id": "UUID_AGENT",
  "type": "product",
  "items": [
    {
      "id": "woo_4587",
      "name": "Robe satin noire",
      "description": "Robe de soiree elegante",
      "price": 18000,
      "stock": 5,
      "currency": "FCFA",
      "sku": "ROB-SAT-NOIR",
      "category": "robes",
      "url": "https://boutique.example.com/produit/robe-satin-noire",
      "image_url": "https://boutique.example.com/img/robe.jpg"
    }
  ]
}
```

## 8. Wizard exact recommande dans le vrai flux actuel

Le wizard actuel de creation suit ces etapes :

1. `mission`
2. `info`
3. `hours`
4. `personality`
5. `rules`
6. `settings`
7. `whatsapp`

Le mode `external_sync` doit s'inserer exactement dans ce wizard, sans le casser.

### Etape 1 - Mission

Comportement actuel :

- l'utilisateur choisit une mission parmi `ecommerce`, `restaurant`, `hotel`, `services`, `support_client`, `custom`

Comportement recommande :

Si l'utilisateur choisit `ecommerce`, afficher immediatement un second bloc juste en dessous :

Titre :

- `Mode e-commerce`

Deux cartes :

- `Native`
- `Catalogue externe via API`

Libelles recommandes :

- `Native`
  - "Catalogue WazzapAI + commandes et checkout natifs"
- `Catalogue externe via API`
  - "Catalogue synchronise depuis votre plateforme + checkout gere hors WazzapAI"

Valeur en base :

- `native`
- `external_sync`

Texte d'aide a afficher si `external_sync` est selectionne :

- "Ce mode est concu pour une plateforme connectee. Les produits seront synchronises par API. Les paiements et commandes resteront geres par votre plateforme."

Regle UX :

- ce bloc n'apparait que si `mission = ecommerce`
- pour toute autre mission, rien ne change

### Etape 2 - Info

Conserver exactement les champs existants :

- nom
- description
- boutique 100% en ligne
- adresse physique
- latitude / longitude
- numero d'escalade / SAV
- site web

Adaptation `external_sync` :

- garder cette etape
- ne rien retirer
- changer seulement les aides textuelles

Texte conseille si `external_sync` :

- "Le catalogue sera fourni par votre plateforme. Renseignez ici l'identite commerciale de l'agent."

Point important :

- `escalation_phone` reste requis
- `site_url` devient encore plus utile en `external_sync`

### Etape 3 - Hours

Conserver l'etape telle quelle.

Pourquoi :

- meme en catalogue externe, l'agent peut avoir des horaires de disponibilite commerciale
- aucune logique critique n'est liee au moteur produit local ici

Donc :

- pas de suppression
- pas de comportement special

### Etape 4 - Personality

Conserver telle quelle.

Le mode `external_sync` n'a pas besoin d'une personnalite differente au niveau technique.

Au maximum :

- on peut preselectionner une personnalite plus professionnelle pour les integrations B2B
- mais ce n'est pas obligatoire

### Etape 5 - Rules

Conserver le champ libre `custom_rules`, mais adapter les exemples si `external_sync`.

Exemples recommandes pour `external_sync` :

```text
CATALOGUE EXTERNE:
- Les produits, prix et disponibilites viennent de notre plateforme
- Ne jamais inventer un stock si l'information n'est pas disponible

CHECKOUT:
- Ne jamais ouvrir un panier natif WazzapAI
- Si le client veut acheter, le rediriger vers notre lien / processus externe

FIABILITE:
- Si une information produit manque, dire que vous verifiez
- Utiliser les donnees synchronisees comme source principale

ESCALADE:
- En cas de litige ou de demande complexe, rediriger vers le SAV
```

### Etape 6 - Settings

C'est ici qu'il faut faire la vraie difference fonctionnelle.

#### En mode `native`

Conserver le comportement actuel :

- langue
- mode de paiement
- Mobile Money direct si choisi
- moyens de paiement manuels
- resume

#### En mode `external_sync`

Masquer ou desactiver toute la section qui suppose un checkout natif local :

- choix `Mode de Paiement`
- numeros Mobile Money
- autres moyens de paiement manuels du tunnel natif

A la place, afficher un bloc informatif :

- `Paiement et commande geres par votre plateforme`

Texte :

- "En mode external_sync, WazzapAI n'encaisse pas et ne cree pas de tunnel checkout natif. Utilisez /sync pour le catalogue et /trigger pour les evenements metier."

Champs avances utiles a ajouter dans cette etape :

- `live_query_url` (optionnel)
- `live_query_secret` (optionnel)
- `external_platform_name` (optionnel, cosmetique V1)

Pourquoi ici :

- ce sont des reglages d'integration
- ils ne concernent que le mode `external_sync`

### Etape 7 - WhatsApp

Conserver telle quelle.

Le raccordement WhatsApp ne change pas selon `ecommerce_mode`.

## 9. Regles UI obligatoires apres creation

Si `mission = ecommerce` et `ecommerce_mode = external_sync` :

- bouton "Ajouter un produit" masque ou desactive pour cet agent
- page produits de cet agent remplacee par un bandeau explicite
- message conseille :
  - "Le catalogue de cet agent est gere par synchronisation API. Utilisez `/api/public/v1/sync` ou votre integration n8n / Make."

Si l'utilisateur tente quand meme d'ajouter un produit via API interne :

- reponse backend a refuser proprement
- message :
  - "Cet agent fonctionne en mode external_sync. Les produits manuels locaux sont desactives."

## 10. Ce que verra un client externe integrateur

Pour un agent `external_sync`, l'integrateur utilisera surtout :

- `POST /api/public/v1/sync`
- `POST /api/public/v1/trigger`
- `POST /api/public/v1/send`
- `GET /api/public/v1/status`
- `GET /api/public/v1/conversations`
- `GET /api/public/v1/conversation`

Usage reel :

- `/sync` = injecter le catalogue ou des donnees metier
- `/trigger` = pousser un evenement type `order_created`, `cart_abandoned`, `payment_failed`
- `/send` = envoyer un message exact
- `/status` = verifier que l'agent est pret
- `/conversation(s)` = relire ce qui s'est passe

## 11. Ce qu'il ne faut pas faire en V1

- ne pas creer une mission `api`
- ne pas cloner la logique e-commerce digitale existante
- ne pas exposer des combinaisons hybrides ambigues
- ne pas forcer les produits externes dans le schema produit local
- ne pas melanger `external_sync` avec le tunnel checkout natif tant que l'adaptateur n'existe pas

## 12. Plan de rollout sans risque

### Phase 1 - Schema additif

- ajouter `ecommerce_mode` sur `agents`
- valeur par defaut `native`

### Phase 2 - Wizard

- afficher le choix `native | external_sync` uniquement quand `mission = ecommerce`
- ne rien changer aux autres missions

### Phase 3 - Garde-fous UI et backend

- bloquer les produits manuels sur `external_sync`
- masquer les reglages de paiement natif sur `external_sync`

### Phase 4 - Integration pilote

- valider avec un agent test dedie
- catalogue pousse via `/sync`
- evenements pousses via `/trigger`
- tests conversationnels reellement bout en bout

## 13. Recommandation finale

Votre intuition etait bonne sur un point :

- il faut simplifier

La meilleure simplification n'est pas "un agent API" distinct.

La meilleure simplification est :

- garder `mission = ecommerce`
- ajouter seulement `ecommerce_mode = native | external_sync`

Mon avis d'expert :

- c'est plus propre
- c'est plus lisible pour le client
- c'est plus facile a maintenir
- c'est beaucoup moins risqué pour la production

Et surtout :

- cela protege toute la logique `ecommerce` deja stable
- tout en ouvrant un vrai mode integrable pour les plateformes externes

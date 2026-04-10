# TASK - Validation WhatsApp Digital 2026-04-10
Date : 2026-04-10

---

## 1. Objectif

Valider de bout en bout le tunnel WhatsApp des produits numeriques apres les correctifs suivants :

- retour direct au recap final apres edition du panier si les infos client sont deja confirmees
- quantite forcee a `1` pour les produits numeriques livres via un lien ou un fichier unique
- quantite `> 1` conservee pour les produits a cles/licences
- protection contre les regressions dues aux messages WhatsApp cites (`En reponse a ...`)
- protection contre les regressions dues aux reponses numeriques citees dans les menus (`1`, `2`, `3`, `4`)
- preservation du cycle de conversation apres livraison
- protection contre la fermeture tardive d'un ancien cycle pendant un nouveau checkout

---

## 2. Correctifs deja en place

- `19698029` - refine digital cart edits and fixed-content quantities
- `75939f28` - ignore quoted reply text in WhatsApp state flows
- `342baa4f` - protect WhatsApp sessions during graceful restarts
- `b2c72723` - prevent stale digital delivery from closing new cycles

Tests automatises cibles deja verts localement :

- `__tests__/unit/whatsapp/cart-state.service.test.js`
- `__tests__/unit/whatsapp/checkout-state.service.test.js`
- `__tests__/unit/whatsapp/message-handler-text.test.js`
- `__tests__/unit/payments/digital-delivery.test.js`
- `__tests__/unit/payments/hosted-checkout-finalization.test.js`

Dernier run cible sur les suites critiques : `20/20` tests passes.

---

## 3. Tests deja valides sur VPS

- [OK] Mono-produit digital simple
  Cas : `Je veux le mini-cours Excel`
  Attendu : checkout digital simple OK, paiement OK, livraison OK.

- [OK] Multi-produit digital explicite
  Cas : `Je veux le mini-cours Excel, le pack fonds d'ecran et 1 logiciel antivirus`
  Attendu : panier multi-produit OK, total OK, livraison OK.

- [OK] Question KB pendant checkout
  Cas : question libre pendant le tunnel digital
  Attendu : le bot repond puis reprend proprement le checkout.

- [OK] Quantite antivirus `x2`
  Cas : `Je veux 2 logiciels antivirus`
  Attendu : commande a `2x`, paiement unique, livraison de `2` cles.

- [OK] Modification de quantite dans le panier
  Cas : modifier `Pack Fonds d'ecran` de `1` a `2`
  Attendu : recap et total corrects.

- [OK] Suppression d'article dans le panier
  Cas : retirer `Pack Fonds d'ecran`
  Attendu : panier recalcule correctement.

- [OK] Retour direct au recap final apres ajout d'article
  Cas : `Mini-cours Excel` puis `Modifier le panier` puis ajout `Pack Fonds d'ecran`
  Attendu : pas de retour a `Vos informations`.

- [OK] Quantite forcee a `1` pour lien/fichier simple
  Cas : `Je veux 2 pack fonds d'ecran`
  Attendu : quantite finale ramenee a `1`.

- [OK] Reconnexion runtime apres incident isole
  Cas : redeploiement, agent marque `Connexion WhatsApp perdue`, puis `Desactiver` -> `Reactiver`
  Attendu : l'agent revient `connected`, repond aux messages, `/health` reste `healthy`, `/sessions` montre l'agent actif sans `pendingConnections`.

---

## 4. Tests critiques restants a rejouer sur VPS

### Priorite haute

- [ ] Antivirus `x4` avec reponses citees WhatsApp
  Cas :
  1. `Je veux 4 logiciels antivirus`
  2. repondre normalement aux questions WhatsApp, idealement en citant les messages du bot
  Attendu :
  - pas de retour au catalogue generique
  - pas de perte du panier
  - recap final correct avec `Logiciel Antivirus x 4`
  - creation d'une seule commande
  Note :
  - un incident de fermeture tardive de cycle post-livraison a ete corrige localement
  - ce test doit etre rejoue juste apres redeploiement pour confirmer la disparition de la regression

- [ ] Reponses citees sur les champs checkout
  Cas :
  1. demarrer une commande digitale
  2. repondre au nom en citant le message du bot
  3. repondre au telephone en citant le message du bot
  4. repondre a l'email en citant le message du bot
  Attendu :
  - le systeme doit prendre la vraie reponse utilisateur
  - il ne doit jamais reutiliser les exemples presents dans les prompts du bot
  - aucun retour au catalogue generique

- [ ] Reponses citees sur les menus numeriques
  Cas :
  1. repondre `1`, `2`, `3` ou `4` en citant le menu precedent
  2. tester au moins une fois sur `Modifier le panier`
  3. tester au moins une fois sur `Confirmer ma commande`
  Attendu :
  - le choix numerique doit etre compris correctement
  - aucune confusion avec le texte cite
  - aucune commande dupliquee

- [ ] Mixte simple + licences
  Cas : `Je veux le mini-cours Excel et 2 logiciels antivirus`
  Attendu :
  - `Mini-cours Excel x 1`
  - `Logiciel Antivirus x 2`
  - une seule commande
  - livraison de 1 document Excel + 2 cles antivirus

- [ ] Double confirmation rapide
  Cas : au moment de `1. Confirmer ma commande`, envoyer `1` deux fois rapidement
  Attendu :
  - une seule commande
  - un seul lien de paiement
  - une seule finalisation paiement/livraison

- [ ] Nouveau cycle apres livraison
  Cas : apres une commande livree, envoyer `Je veux encore 1 logiciel antivirus`
  Attendu :
  - nouveau cycle propre
  - aucun ancien panier repris
  - aucune ancienne info de checkout reinjectee de facon incoherente

### Priorite moyenne

- [ ] Produit simple digital avec formulation naturelle de quantite
  Cas : `Je veux 4 pack fonds d'ecran`
  Attendu :
  - le bot ne doit pas demander `4`
  - la quantite finale doit rester `1`
  - le recap final ne doit pas afficher `x4`

- [ ] Edition panier sur produit simple digital deja dans le panier
  Cas :
  1. `Je veux le pack fonds d'ecran`
  2. `3. Modifier le panier`
  3. tenter `Modifier la quantite`
  Attendu :
  - le bot doit expliquer que la quantite reste `1`
  - retour propre au panier

- [ ] Mixte naturel simple + licence avec quantites differentes
  Cas : `Je veux 2 pack fonds d'ecran et 3 logiciels antivirus`
  Attendu :
  - `Pack Fonds d'ecran x 1`
  - `Logiciel Antivirus x 3`
  - total coherent
  - livraison : un seul lien/fichier pour le pack et 3 cles pour l'antivirus

- [ ] Question hors parcours apres paiement recu
  Cas : juste apres `Paiement recu !`, envoyer un message libre
  Attendu :
  - pas de creation de nouvelle commande parasite
  - la livraison continue normalement

- [ ] Reouverture saine apres bruit systeme
  Cas :
  1. finir une commande
  2. attendre quelques messages `append` / reconnexion dans les logs
  3. relancer une nouvelle commande simple
  Attendu :
  - la nouvelle commande doit repartir proprement
  - aucun panier fantome
  - aucune conversation parasite `status@broadcast` exploitee cote metier

---

## 5. Couverture des situations a surveiller

Cette recette doit couvrir les situations suivantes :

- produit numerique simple seul
- produit numerique a licences seul
- panier digital mixte simple + licences
- ajout article apres confirmation des infos
- suppression article
- modification quantite
- quantite `> 1` sur licences
- quantite `> 1` sur lien/fichier simple
- reponse citee sur nom / telephone / email
- reponse citee sur choix de menu numerique
- message WhatsApp cite pendant les champs checkout
- double clic logique sur confirmation
- nouveau cycle apres livraison
- absence de duplication de commande
- absence de livraison incoherente
- absence de fermeture tardive d'un ancien cycle qui efface un nouveau checkout

Si une de ces lignes n'est pas couverte par un test reel, la recette n'est pas consideree complete.

---

## 6. Verifications SQL apres les tests restants

### 6.1 Dernieres commandes

```sql
select
  id,
  status,
  payment_provider,
  transaction_id,
  customer_phone,
  customer_email,
  total_fcfa,
  created_at,
  updated_at
from public.orders
where agent_id = '4da7c8a3-f4b9-40ea-8bbd-ecf286d830f0'
order by created_at desc
limit 10;
```

### 6.2 Lignes de commande

```sql
select
  o.created_at as order_created_at,
  o.id as order_id,
  o.status,
  oi.product_name,
  oi.quantity,
  oi.unit_price_fcfa,
  (coalesce(oi.quantity, 0) * coalesce(oi.unit_price_fcfa, 0)) as line_total_fcfa_calc
from public.orders o
join public.order_items oi on oi.order_id = o.id
where o.agent_id = '4da7c8a3-f4b9-40ea-8bbd-ecf286d830f0'
order by o.created_at desc, oi.created_at asc
limit 20;
```

### 6.3 Messages sortants

```sql
select
  created_at,
  recipient_phone,
  message_content,
  media_url,
  media_type,
  status
from public.outbound_messages
where agent_id = '4da7c8a3-f4b9-40ea-8bbd-ecf286d830f0'
order by created_at desc
limit 30;
```

### 6.4 Conversations recentes

```sql
select
  id,
  contact_phone,
  contact_jid,
  status,
  bot_paused,
  metadata->'cart' as cart,
  metadata->'checkout' as checkout,
  metadata->>'session_anchor_at' as session_anchor_at,
  updated_at
from public.conversations
where agent_id = '4da7c8a3-f4b9-40ea-8bbd-ecf286d830f0'
order by updated_at desc
limit 5;
```

---

## 7. Verifications logs VPS

### Live

```bash
tail -F ~/.pm2/logs/whatsai-web-out.log ~/.pm2/logs/whatsai-web-error.log ~/.pm2/logs/whatsai-bot-out.log ~/.pm2/logs/whatsai-bot-error.log | grep --line-buffered -iE "KONO ONLINE|ERROR|CRITICAL|fallback|checkout|create order|paystack|payment|digital delivery|queued|paid|completed|messages.upsert|Processing|reopened for a new cycle"
```

### Snapshot

```bash
pm2 logs whatsai-web --lines 120 --nostream | grep -iE "KONO ONLINE|paystack|payment|digital delivery|queued|completed|webhook|status|ERROR|CRITICAL"
```

```bash
pm2 logs whatsai-bot --lines 160 --nostream | grep -iE "KONO ONLINE|messages.upsert|Processing|fallback|ERROR|CRITICAL|reopened for a new cycle"
```

### Signal a rechercher pendant les tests cites

- ne pas voir un retour inattendu vers `Bienvenue chez KONO ONLINE`
- ne pas voir de reprise parasite du catalogue en plein checkout
- tolerer le bruit Baileys `status@broadcast` si le tunnel metier reste intact

---

## 8. Criteres de cloture

La recette est consideree terminee seulement si :

- tous les tests de la section 4 sont coches `[OK]`
- aucune commande dupliquee n'apparait en base
- aucun produit simple a lien/fichier n'est commande au-dela de `x1`
- les licences restent livrees avec la bonne quantite
- aucun retour parasite au catalogue generique n'apparait pendant le checkout
- aucun ancien panier n'est repris lors d'un nouveau cycle

---

## 9. Notes d'attention

- Les erreurs `status@broadcast` visibles dans les logs Baileys peuvent etre du bruit transport et ne suffisent pas a conclure a une regression metier.
- Le warning `url generation failed` reste a surveiller, mais si la commande est creee, payee et livree correctement, ce n'est pas le bug prioritaire du tunnel WhatsApp.
- Le vrai signal de regression est fonctionnel :
  - panier perdu
  - recap incoherent
  - catalogue generique relance a tort
  - quantite/licence/livraison incorrecte

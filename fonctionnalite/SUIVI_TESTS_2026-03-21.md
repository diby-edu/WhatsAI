# Suivi des tests — Bot WhatsApp Tychou Boutique
**Date :** 2026-03-21
**Produits de test :** T-Shirt Classic (N1), Robe de Soirée (N2), Veste Ajustée (N3), E-Book (Digital), Casquette (Simple)

---

## Tests validés ✅

| Test | Action | Résultat |
|------|--------|---------|
| 1 | "bonjour" → catalogue | Catalogue affiché avec 5 produits numérotés ✅ |
| 2 | "t-shirt" → affichage N1 | Format correct : prix + couleurs + tailles groupés ✅ |
| 3 | "1 blanc m et 2 gris s" → commande | 2 lignes de panier, total 15 000 FCFA ✅ |
| 4 | "non" → checkout | Bot passe au checkout et demande nom/tel/adresse ✅ |
| 5 | Checkout complet | Récapitulatif correct, commande confirmée ✅ |
| 6 | Vérification SQL | CMD-20260321-7902 en DB avec 2 lignes correctes ✅ |

---

## Anomalies constatées 🔴

### Anomalie 1 — "Je note" omniprésent au checkout (CRITIQUE)
**Observé :**
- "Je note ces lignes : ..."
- "Je note votre nom complet : Jean kouadio."
- "Je note votre numéro de téléphone."
- "Je note votre adresse de livraison."
- "Je note un paiement à la livraison."
- "Je note que vous n'avez pas d'instruction particulière."
**Attendu :** Ton naturel et conversationnel, sans répéter "Je note" à chaque étape
**Cause :** La règle actuelle dans `prompt-builder.js` interdit "Je note" uniquement
en DÉBUT de réponse. L'IA l'utilise librement au milieu de ses phrases de checkout.
**Fix à faire :** Renforcer la règle pour interdire "Je note" partout (pas seulement en début),
et revoir le template checkout pour guider l'IA vers des confirmations naturelles.
**Fichiers concernés :** `src/lib/whatsapp/ai/prompt-builder.js`
**Priorité :** HAUTE

### Anomalie 2 — "Je note ces lignes" redondant dans le récap panier
**Observé :**
```
Je note ces lignes :
· T-Shirt Classic (M, Blanc) x 1 = 5 000 FCFA
· T-Shirt Classic (S, Gris) x 2 = 10 000 FCFA

Panier actuel :
· T-Shirt Classic (M, Blanc) x 1 = 5 000 FCFA
· T-Shirt Classic (S, Gris) x 2 = 10 000 FCFA

Total : 15 000 FCFA
```
**Attendu :** Afficher directement le panier sans répéter les lignes deux fois :
```
Panier actuel :
· T-Shirt Classic (M, Blanc) x 1 = 5 000 FCFA
· T-Shirt Classic (S, Gris) x 2 = 10 000 FCFA

Total : 15 000 FCFA
Souhaitez-vous ajouter un autre article ou continuer ?
```
**Cause :** `buildBatchCartReply` construit un intro "Je note ces lignes" + le récap complet.
L'intro est redondante car le récap contient déjà toutes les lignes.
**Fix à faire :** Supprimer le bloc intro dans `buildBatchCartReply` — afficher directement
le récap panier.
**Fichiers concernés :** `src/lib/whatsapp/services/cart-state.service.js` — `buildBatchCartReply`
**Priorité :** HAUTE

### Anomalie 3 — Badge "SUPPLÉMENT" dans l'interface (FAUSSE ALERTE ✅)
**Observé :** Badge "SUPPLÉMENT" affiché sur la variante Couleur dans l'UI
**Vérification SQL :** `variant_type = "required"` pour toutes les variantes → correct
**Conclusion :** Le badge "SUPPLÉMENT" est un label visuel de l'UI pour la catégorie
`visual` (Couleur/Style). Il ne reflète pas le champ `type` fonctionnel.
Aucun impact sur le bot — les variantes sont bien bloquantes.
**Priorité :** ANNULÉE

### Anomalie 4 — Colonne `product_description` dans order_items contient la description produit
**Observé :** `product_description = "T-shirt unisexe en coton 100%"` au lieu des variantes
**Attendu :** `product_description = "Blanc, M"`
**Note :** Les variantes sont déjà dans le nom du produit ("T-Shirt Classic (Blanc, M)"),
donc l'info n'est pas perdue, mais la colonne devrait contenir les variantes pour les rapports.
**Fichiers concernés :** `src/lib/whatsapp/ai/tools/tool-orders.js`
**Priorité :** Moyenne

---

## Tests restants à faire 🔲

| Test | Action | Statut |
|------|--------|--------|
| 7 | "robe" → affichage N2 | En cours |
| 8 | "veste" → affichage N3 + overflow | À faire |
| 9 | "plus veste" → combos restants | À faire |
| 10 | "robe et veste" → prompt multi-produits ①② | À faire |
| 11 | Réponse article par article (message par message) | À faire |
| 12 | Réponse tout en une ligne | À faire |
| 13 | Quantité en fin de segment ("Robe Noire L 2") | À faire |
| 14 | "e-book" → affichage digital | À faire |
| 15 | "casquette" → affichage simple sans variante | À faire |
| 16 | Sélection par numéro ("3") | À faire |

# Plan de tests complet — Bot WhatsApp Tychou Boutique
**Date :** 2026-03-21
**Produits de test :** T-Shirt Classic (N1), Robe de Soirée (N2), Veste Ajustée (N3), E-Book (Digital), Casquette (Simple)

---

## Session A — mono-produits

### Étape 1
**Envoyer :** `bonjour`
**Résultat attendu :**
```
Bienvenue chez Tychou Boutique ! 👋
1. T-Shirt Classic
2. Robe de Soirée
3. Veste Ajustée
4. E-Book
5. Casquette
Quel article vous intéresse ?
```

---

### Étape 2
**Envoyer :** `t-shirt`
**Résultat attendu :**
```
*T-Shirt Classic* — 5 000 FCFA
Couleur : Blanc · Noir · Gris
Taille : S · M · L · XL
(ex : "2 Noir L et 1 Gris M")
```

---

### Étape 3
**Envoyer :** `2 noir l et 1 gris m`
**Résultat attendu :**
```
Panier actuel :
· T-Shirt Classic (Noir, L) x 2 = 10 000 FCFA
· T-Shirt Classic (Gris, M) x 1 = 5 000 FCFA
Total : 15 000 FCFA
Souhaitez-vous ajouter un autre article ou continuer ?
```
**Vérifier :** pas de "Je note ces lignes" avant le panier

---

### Étape 4
**Envoyer dans l'ordre :** `non` → nom → téléphone → adresse → `à la livraison` → `aucune`
**Résultat attendu :** Confirmation avec numéro CMD-XXXXXXXX-XXXX
**Vérifier :** pas de "Je note" dans les réponses du bot pendant le checkout

**SQL à coller dans Supabase :**
```sql
SELECT o.order_number, o.status, o.total_amount, o.customer_name,
       oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 5;
```
**Vérifier :** 1 commande status=`pending`, 2 lignes (Noir L x2 + Gris M x1), total = 15 000

---

### Étape 5
**Nouvelle conversation** (réinitialiser ou utiliser un autre numéro)
**Envoyer :** `veste`
**Résultat attendu :**
```
*Veste Ajustée* — X à Y FCFA
· Noire / S — X FCFA
· Noire / M — X FCFA
...
(+ N autres : tapez "plus veste")
```
**Vérifier :** maximum 8 combos affichés, message overflow présent

---

### Étape 6
**Envoyer :** `plus veste`
**Résultat attendu :**
```
*Veste Ajustée* — combinaisons restantes :
· Rose / XL — X FCFA
· Rose / XXXL — X FCFA
...
```
**Vérifier :** uniquement les combos non affichés à l'étape 5

---

### Étape 7
**Envoyer :** `2 noire s`
**Résultat attendu :** Panier avec Veste Ajustée (Noire, S) x 2
Puis checkout complet → confirmation

**SQL :**
```sql
SELECT o.order_number, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 3;
```
**Vérifier :** 1 ligne, Veste Noire S x 2

---

### Étape 8
**Nouvelle conversation**
**Envoyer :** `robe`
**Résultat attendu (N2) :**
```
*Robe de Soirée*
· Noire : L · M · XL — 50 000 FCFA
· Rouge : L · M · XL · XXL — 100 000 FCFA
· Belge : L · M — 150 000 FCFA
```
**Vérifier :** prix différents par couleur, tailles groupées par couleur

---

### Étape 9
**Envoyer :** `2 belge, 1 rouge`
**Résultat attendu — question 1 :**
```
Quelle taille pour les 2 × Belge ?
(L, M — répondez simplement ex : "L")
```
**Envoyer :** `M`
**Résultat attendu — question 2 :**
```
Quelle taille pour le Rouge ?
(L, M, XL, XXL — répondez simplement ex : "L")
```
**Envoyer :** `XL`
**Résultat attendu — récap :**
```
Panier actuel :
· Robe de Soirée (Belge, M) x 2 = 300 000 FCFA
· Robe de Soirée (Rouge, XL) x 1 = 100 000 FCFA
Total : 400 000 FCFA
```

---

### Étape 10
**Envoyer :** `non` → checkout complet

**SQL :**
```sql
SELECT o.order_number, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 5;
```
**Vérifier :** 2 lignes (Belge M x2 + Rouge XL x1), totaux corrects

---

## Session B — multi-produits

### Étape 1
**Nouvelle conversation**
**Envoyer :** `robe et veste`
**Résultat attendu :**
```
① *Robe de Soirée*
   · Noire : L · M · XL — 50 000 FCFA
   ...

② *Veste Ajustée* — X à Y FCFA
   · Noire / S — X FCFA
   ...
   (+ N autres : tapez "plus veste")

Précisez variante(s) + quantité pour chaque :
(ex : "2 Robe Noire XL, 1 Veste Noire S")
```

---

### Étape 2
**Envoyer message 1 :** `2 robe noire xl`
**Résultat attendu :**
```
Noté ! Il reste : Veste Ajustée.
Précisez variante(s) + quantité pour cet article.
```
**Envoyer message 2 :** `1 veste noire s`
**Résultat attendu — récap :**
```
Panier actuel :
· Robe de Soirée (Noire, XL) x 2 = 100 000 FCFA
· Veste Ajustée (Noire, S) x 1 = X FCFA
Total : X FCFA
```

---

### Étape 3
**Envoyer :** `non` → checkout complet

**SQL :**
```sql
SELECT o.order_number, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 5;
```
**Vérifier :** 2 lignes distinctes (1 robe + 1 veste)

---

### Étape 4
**Nouvelle conversation**
**Envoyer :** `casquette`
**Résultat attendu :** affichage avec prix, bot demande la quantité directement (pas de variantes)
**Envoyer :** `2`
**Résultat attendu :** Panier avec Casquette x 2
Checkout complet

**SQL :**
```sql
SELECT o.order_number, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 3;
```
**Vérifier :** 1 ligne, Casquette x 2

---

### Étape 5
**Nouvelle conversation**
**Envoyer :** `e-book`
**Résultat attendu :**
```
*E-Book* — X FCFA (téléchargement immédiat)
```
**Envoyer :** `1`
**Résultat attendu :** Panier avec E-Book x 1
Checkout complet

**SQL :**
```sql
SELECT o.order_number, oi.product_name, oi.quantity, oi.unit_price
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
ORDER BY o.created_at DESC
LIMIT 3;
```
**Vérifier :** 1 ligne, E-Book x 1

# Fonctionnalité : Affichage produits N1/N2/N3 & Commande multi-produits

**Date d'implémentation :** 2026-03-21
**Fichier cible :** `src/lib/whatsapp/services/cart-state.service.js`

---

## Contexte

Avant cette fonctionnalité, le bot affichait tous les combos bruts de chaque produit en une
seule liste (wall of text sur WhatsApp). Pour une commande de plusieurs produits, le message
était illisible. La nouvelle architecture résout ces deux problèmes.

---

## Architecture : 3 niveaux d'affichage (`detectPricingLevel`)

### N1 — Prix uniforme
Le produit a un prix unique quelle que soit la variante choisie
(ou pas de combos avec prix différents).

**Affichage :**
```
*T-Shirt Classic* — 5 000 FCFA
Couleur : Blanc · Noir · Gris
Taille : S · M · L · XL
```

### N2 — Prix par variante dominante (pivot)
Les prix varient selon UNE variante (ex: couleur), mais pour une même couleur toutes les
tailles ont le même prix.

**Affichage :**
```
*Robe de Soirée*
· Noire : L · M · XL — 50 000 FCFA
· Rouge : L · M · XL · XXL — 100 000 FCFA
· Belge : L · M — 150 000 FCFA
```

### N3 — Prix par combo individuel
Les prix varient vraiment combo par combo (pas réductible à N2).

**Affichage (tronqué à maxCombos, overflow via "plus [produit]") :**
```
*Veste Ajustée* — 40 000 à 90 000 FCFA
· Noire / S — 40 000 FCFA
· Noire / M — 45 000 FCFA
· Rose / XXXL — 90 000 FCFA
...
(+ 4 autres : tapez "plus veste")
```

---

## Fonctions principales ajoutées

### `detectPricingLevel(product)` → `'N1' | 'N2' | 'N3'`
- N1 : `hasPricedCombinations` = false, OU tous les combos ont le même prix
- N2 : Il existe un groupe de variante (pivot) tel que chaque option de ce groupe
  crée un groupe de combos iso-prix
- N3 : hasPricedCombinations = true ET pas N2

### `buildProductBlock(product, maxCombos)` → `{ level, text, hasOverflow, overflowCombos }`
Construit le bloc texte formaté selon le niveau détecté.

**Types de produits gérés :**
- `physical` (défaut) : N1/N2/N3 selon les combinaisons
- `digital` : affichage simplifié `*Nom* — Prix (téléchargement immédiat)` sans variantes
- `service` : ne passe pas par ce flux (flux booking séparé via `booking-state.service.js`)

### `extractQuantityFromSegment(text)` → `number | null`
Extraction intelligente de la quantité dans un segment multi-produits.
Distingue la quantité des numéros de tailles (ex: "41-43").

**Cas gérés :**
- `"2 T-shirt Noir L"` → 2 (nombre en début)
- `"T-shirt Noir L 2"` → 2 (nombre isolé en fin)
- `"3 Chaussettes 41-43"` → 3 (début, "41" n'est pas en fin isolée)
- `"Chaussettes 41-43 3"` → 3 (fin isolée, "41" est au milieu)

Si aucune quantité n'est trouvée dans un segment, **défaut = 1**.

---

## Flux mono-produit

```
Client : t-shirt
Bot    : *T-Shirt Classic* — 5 000 FCFA
          Couleur : Blanc · Noir · Gris
          Taille : S · M · L · XL
          (ex : "2 Noire L et 1 Grise M")

Client : 2 noir l et 1 gris m
Bot    : Panier actuel :
          - T-Shirt Classic (Noir, L) x 2 = 10 000 FCFA
          - T-Shirt Classic (Gris, M) x 1 = 5 000 FCFA
          Total : 15 000 FCFA
          Souhaitez-vous ajouter un autre article ou continuer ?
```

**Overflow N3 (tapez "plus") :**
```
Client : veste
Bot    : *Veste Ajustée* — 40 000 à 90 000 FCFA
          · Noire / S — 40 000 FCFA
          · Noire / M — 45 000 FCFA
          ...
          (+ 2 autres : tapez "plus veste")

Client : plus veste
Bot    : *Veste Ajustée* — combinaisons restantes :
          · Rose / XL — 80 000 FCFA
          · Rose / XXXL — 90 000 FCFA
```

---

## Flux multi-produits

### Déclenchement
Quand le client mentionne ≥ 2 produits dans un message (panier vide).
**Exclus :** produits de type `service` (ils déclenchent le flux booking).

**Seuil de détection :** 15 points (vs 30 pour mono-produit), pour permettre la
reconnaissance de noms courts dans des segments comme `"robe, veste et t-shirt"`.

### Max combos N3 selon le nombre de produits

| Nb produits | Max combos N3 |
|-------------|---------------|
| 1           | 8             |
| 2           | 6             |
| 3           | 4             |
| 4+          | 3             |

### Exemple parcours (3 produits mixtes)

```
Client : t-shirt, robe et veste

Bot    : Voici les choix disponibles pour chaque article :

         ① *T-Shirt Classic* — 5 000 FCFA
           Couleur : Blanc · Noir · Gris
           Taille : S · M · L · XL

         ② *Robe de Soirée*
           · Noire : L · M · XL — 50 000 FCFA
           · Rouge : L · M · XL · XXL — 100 000 FCFA

         ③ *Veste Ajustée* — 40 000 à 90 000 FCFA
           · Noire / S — 40 000 FCFA
           · Noire / M — 45 000 FCFA
           · Rose / S — 70 000 FCFA
           · Rose / M — 75 000 FCFA
           (+ 2 autres : tapez "plus veste")

         Précisez variante(s) + quantité pour chaque :
         (ex : "2 T-shirt Noir L, 2 Robe Noire, 1 Veste Noire S")
```

### Formats de réponse supportés

Le bot accepte les 4 formats suivants indifféremment :

**1. Tout sur une ligne (séparateurs : virgule, "et", "puis", "+") :**
```
2 T-shirt Noir L, 1 Robe Noire XL, 3 Veste Noire S
```

**2. Multi-ligne (un article par ligne) :**
```
2 T-shirt Noir L
1 Robe Noire XL
3 Veste Noire S
```

**3. Message par message (un article par message) :**
```
[Message 1] : 2 T-shirt Noir L
Bot → "Noté ! Il reste : Robe de Soirée, Veste Ajustée. Précisez variante(s) + quantité pour cet article."

[Message 2] : 1 Robe Noire XL
Bot → "Noté ! Il reste : Veste Ajustée. ..."

[Message 3] : 3 Veste Noire S
Bot → Récap final ✓
```

**4. Quantité en fin de segment :**
```
T-shirt Noir L 2
Robe Noire XL 1
Veste Noire S 3
```

**5. Quantité absente → défaut = 1 :**
```
T-shirt Noir L, Robe Noire XL, Veste Noire S
→ Chaque article commandé en quantité 1
```

---

## Tolérance aux fautes d'orthographe

**Mécanisme :** normalisation + matching par tokens (pas de distance d'édition).

- Accents supprimés : "Noire" → "noire", "Beyoncé" → "beyonce"
- Tokenisation : le nom du produit est découpé en mots (> 2 chars) ; un segment doit
  contenir au moins un token du nom pour obtenir un score ≥ 15 (seuil multi-produits)
- Exemples qui passent : "tshirt", "t shirt", "casquett" (token "casquet" non reconnu
  car < 2/3 chars overlap → limite du système)
- Exemples qui ne passent pas : fautes importantes sur le premier mot unique du produit

**Limite connue :** Pas de fuzzy matching (Levenshtein). Une faute sur 2+ caractères
d'un token court peut empêcher la reconnaissance.

---

## Accumulation message par message (`lines_collected`)

L'état `awaiting_field` pour `multi_product_combos` stocke :
```json
{
  "type": "multi_product_combos",
  "product_ids": ["uuid1", "uuid2", "uuid3"],
  "overflow": { "uuid3": [...combos_overflow...] },
  "lines_collected": [
    { "product_id": "uuid1", "product_name": "T-Shirt", "quantity": 2, ... }
  ]
}
```

À chaque message, les nouvelles lignes sont fusionnées dans `lines_collected`.
Le récap final n'est déclenché que quand tous les `product_ids` sont couverts.

---

## Produits digitaux

Les produits `product_type === 'digital'` sont affichés avec :
```
*Nom du produit* — Prix (téléchargement immédiat)
```
Pas de variantes physiques. Pas de combos. La commande ne nécessite que la quantité.

---

## Produits service

Les produits `product_type === 'service'` sont **exclus** de la détection multi-produits
(`detectMultipleProducts`) et du parsing batch (`parseMultiProductBatchLines`).
Ils déclenchent le flux `booking-state.service.js` avec les engines STAY/TABLE/SLOT/RENTAL.

---

## Handler "plus [produit]"

Quand `awaiting_field.overflow` contient des combos non affichés (N3 tronqué) :
```
Client : plus veste
Bot    : *Veste Ajustée* — combinaisons restantes :
         · Rose / XL — 80 000 FCFA
         · Rose / XXXL — 90 000 FCFA
```

Fonctionne pour mono-produit (overflow stocké dans `awaiting_field.overflow`) et
multi-produits (overflow par `product_id` dans le même champ).

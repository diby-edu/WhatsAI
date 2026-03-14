# Statuts de commande — Logique et boutons d'action

## Vue d'ensemble

Chaque commande passe par une série de statuts selon son mode de paiement et
le type d'article commandé. Le marchand voit directement tous les boutons
d'action disponibles sur la carte commande (liste) et sur la page de détail,
sans avoir à naviguer étape par étape.

Les statuts terminaux (`delivered`, `cancelled`) ne proposent aucun bouton.

---

## Modes de paiement

| Code | Nom | Description |
|---|---|---|
| `cod` | Cash on Delivery | Paiement en espèces à la livraison |
| `mobile_money_direct` | Mobile Money Direct | Orange Money, MTN, Wave — validation manuelle |
| `online` | CinetPay | Paiement en ligne — validation automatique par webhook |

## Types d'articles

| Type | Exemples |
|---|---|
| Physique | Vêtements, produits alimentaires, électronique |
| Service | Coiffeur, coaching, consultation, hôtel, restaurant |
| Numérique | Licence logicielle, ebook, clé d'activation |

---

## Matrice complète des boutons d'action

### 1. `pending` + COD + Physique

Le client a commandé un article physique et paiera à la livraison.

**Boutons affichés :** `[📦 Expédier]` `[✅ Livré]` `[❌ Annuler]`

- **Expédier** : à utiliser si tu passes par un transporteur et veux enregistrer l'étape d'envoi avant la réception.
- **Livré** : à utiliser si tu gères toi-même la remise en main propre et veux clôturer directement.
- **Annuler** : si la commande ne peut pas être honorée.

---

### 2. `pending` + COD + Service

Le client a réservé un service (coiffeur, coaching…) et paiera sur place le jour de la prestation.

**Boutons affichés :** `[✅ Confirmer]` `[🎉 Terminé]` `[❌ Annuler]`

- **Confirmer** : pour valider le rendez-vous et informer le client que la prestation est acceptée.
- **Terminé** : pour clôturer directement si la prestation est déjà effectuée.
- **Annuler** : si tu ne peux pas assurer le service.

---

### 3. `pending` + Mobile Money Direct

Le client dit avoir payé par Orange Money / MTN Money / Wave mais le paiement n'est pas encore vérifié côté marchand.

**Boutons affichés :** `[✅ Valider paiement]` `[❌ Annuler]`

- **Valider paiement** : après avoir contrôlé la capture d'écran du virement. Déclenche un message WhatsApp de confirmation au client.
- **Annuler** : si le paiement n'arrive pas ou est invalide.

> Le saut direct vers "Livré" ou "Expédier" est intentionnellement bloqué : le paiement doit être validé en premier.

---

### 4. `pending` + CinetPay (online)

Le client a initié un paiement en ligne. CinetPay valide automatiquement via webhook dès que le paiement aboutit — aucune action manuelle de paiement n'est nécessaire.

**Boutons affichés :** `[❌ Annuler]`

- **Annuler** : uniquement si tu dois rembourser et clore la commande manuellement.

---

### 5. `pending_delivery` + COD + Physique

Commande créée directement par le bot WhatsApp (le client a commandé via la conversation), déjà engagée, en attente de livraison physique. Pas de bouton Annuler car la commande est confirmée côté client.

**Boutons affichés :** `[📦 Expédier]` `[✅ Livré]`

---

### 6. `pending_delivery` + COD + Service

Service créé par le bot, en attente de prise en charge par le marchand.

**Boutons affichés :** `[✅ Confirmer]` `[🎉 Terminé]`

---

### 7. `paid` + Physique

Paiement confirmé (CinetPay via webhook ou Mobile Money validé manuellement). L'article attend d'être envoyé.

**Boutons affichés :** `[📦 Expédier]` `[✅ Livré]`

- **Expédier** : si tu remets la commande à un transporteur.
- **Livré** : si tu gères toi-même la remise en main propre.

---

### 8. `paid` + Service

Paiement confirmé. La prestation est à venir.

**Boutons affichés :** `[✅ Confirmer]` `[🎉 Terminé]`

---

### 9. `paid` + Numérique

Le produit numérique (licence, ebook, clé…) a été livré automatiquement par le système dès la confirmation du paiement.

**Boutons affichés :** aucun

Rien à faire manuellement.

---

### 10. `confirmed` + Physique

Commande confirmée, en attente d'expédition.

**Boutons affichés :** `[📦 Expédier]` `[✅ Livré]`

---

### 11. `confirmed` + Service

Rendez-vous confirmé. La prestation est planifiée.

**Boutons affichés :** `[🎉 Marquer terminé]`

À utiliser après la prestation pour clôturer la commande.

---

### 12. `processing` + Physique

Commande en cours de préparation (état rare, souvent injecté via webhook ou ancienne logique).

**Boutons affichés :** `[📦 Expédier]` `[✅ Livré]`

---

### 13. `processing` + Service

Service en cours de préparation.

**Boutons affichés :** `[✅ Confirmer]` `[🎉 Terminé]`

---

### 14. `shipped`

Commande remise à un transporteur, en transit vers le client.

**Boutons affichés :** `[✅ Livré]`

À cliquer dès que la réception par le client est confirmée.

---

### 15. `delivered` / `cancelled`

Statuts terminaux. La commande est clôturée.

**Boutons affichés :** aucun

---

## Notifications WhatsApp automatiques

À chaque changement de statut, le client reçoit un message WhatsApp si sa commande a un numéro de téléphone et un agent associé.

| Statut | Message envoyé au client |
|---|---|
| `paid` | Paiement confirmé, commande en cours de préparation |
| `confirmed` | Commande confirmée, service en préparation |
| `shipped` | Commande en route |
| `delivered` | Commande livrée |
| `cancelled` | Commande annulée |

Les notifications sont non-bloquantes : si WhatsApp est indisponible, le changement de statut est quand même enregistré.

---

## Fichiers concernés

| Fichier | Rôle |
|---|---|
| `src/app/[locale]/dashboard/orders/page.tsx` | Liste des commandes — boutons inline sur chaque carte |
| `src/app/[locale]/dashboard/orders/[id]/page.tsx` | Page de détail — section Actions |
| `src/app/api/orders/[id]/status/route.ts` | API PATCH — mise à jour du statut + notifications WhatsApp |

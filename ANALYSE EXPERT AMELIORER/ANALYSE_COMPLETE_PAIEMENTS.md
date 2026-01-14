# 🔍 ANALYSE COMPLÈTE - LES 3 FLUX DE PAIEMENT

## ⚠️ TU AS RAISON !

Il y a bien **3 flux de paiement distincts**, et mon analyse précédente était **INCOMPLÈTE**.

---

## 📊 LES 3 MODES DE PAIEMENT IDENTIFIÉS

### Configuration Agent (Table `agents`)

```sql
agents:
  - payment_mode: text  
      → 'mobile_money_direct' OU null (CinetPay par défaut)
  - mobile_money_orange: text
  - mobile_money_mtn: text  
  - mobile_money_wave: text
  - custom_payment_methods: jsonb
```

### Configuration Commande (Tool `create_order`)

```javascript
payment_method: 'online' | 'cod'
```

---

## 🔄 FLUX 1 : PAIEMENT À LA LIVRAISON (COD)

### Déclenchement
```javascript
// Dans tools.js ligne 254
if (payment_method === 'cod') {
    status: 'pending_delivery'
}
```

### Confirmation
**Type** : IMMÉDIATE (pas de paiement en ligne)

**Message Bot** :
```javascript
"Commande #ABC123 créée. 
Total: 30,000 FCFA. 
Paiement à la livraison."
```

### Statuts
- `pending_delivery` → En attente livraison
- `delivered` → Livré et payé

### ❌ CE QUI MANQUE DANS MON PROMPT v2.1

**Principe 10 actuel** : Ne traite que les paiements en ligne
**Problème** : Pas de guidance pour COD

**Manque** :
- Rassurer client sur COD ("Vous paierez à la réception")
- Expliquer le process ("Le livreur vous contactera")
- Confirmer quand livré ("Merci pour votre paiement cash")

---

## 🔄 FLUX 2 : PAIEMENT EN LIGNE MOBILE MONEY DIRECT

### Déclenchement
```javascript
// Dans tools.js ligne 261
if (agent.payment_mode === 'mobile_money_direct') {
    // Mode manuel activé
}
```

### Configuration Requise
```javascript
agent.mobile_money_orange = "0707070707"  // Numéro Orange Money
agent.mobile_money_mtn = "0808080808"     // Numéro MTN Money  
agent.mobile_money_wave = "0909090909"    // Numéro Wave
agent.custom_payment_methods = [
    { name: "Moov Money", details: "0606060606" }
]
```

### Message Bot
```javascript
"Commande #ABC123 créée. Total: 30,000 FCFA.

📱 *Choisissez votre mode de paiement :*
🟠 Orange Money : 0707070707
🟡 MTN Money : 0808080808
🔵 Wave : 0909090909

⚠️ Après le paiement, envoyez une capture d'écran pour confirmation."
```

### Statuts
```javascript
order.payment_verification_status = 'awaiting_screenshot'
```

### Flux de Confirmation

1. **Client paie manuellement** via son app Mobile Money
2. **Client envoie screenshot** sur WhatsApp
3. **Marchand vérifie manuellement** (pas d'API)
4. **Marchand confirme** dans le dashboard
5. **Status change** : `pending` → `paid`

### ❌ CE QUI MANQUE DANS MON PROMPT v2.1

**Principe 10 actuel** : Ne gère que CinetPay
**Problème** : Pas de guidance pour Mobile Money Direct

**Manque** :
- Demander screenshot ("Envoyez la capture svp")
- Rassurer pendant attente ("Vérification en cours")
- Confirmer réception screenshot ("Screenshot reçu, vérification...")
- Expliquer délai validation ("Confirmation sous 1-2h")
- Relancer si pas de screenshot après 30 min

---

## 🔄 FLUX 3 : PAIEMENT EN LIGNE CINETPAY

### Déclenchement
```javascript
// Dans tools.js ligne 286
else {
    // Mode CinetPay (par défaut si payment_mode != 'mobile_money_direct')
}
```

### Message Bot
```javascript
"Commande #ABC123 créée. Total: 30,000 FCFA."
payment_link: "https://whatsai.duckdns.org/pay/{order_id}"
```

### Flux de Confirmation

1. **Client clique** sur le lien
2. **Client paie** via CinetPay (Mobile Money, Carte, etc.)
3. **CinetPay webhook** déclenché automatiquement
4. **Status change** : `pending` → `paid`
5. **Message auto** : "✅ Paiement reçu !"

### ✅ CE QUI EXISTE DÉJÀ

- ✅ Webhook automatique
- ✅ Message confirmation auto
- ✅ Principe 10 dans v2.1 (partiellement)

### ⚠️ CE QUI MANQUE

- Gestion des échecs CinetPay (existe dans Principe 8 ✅)
- Relance si pas de paiement après 15 min (existe dans jobs.js ✅)

---

## 📋 RÉCAPITULATIF - QU'EST-CE QUI MANQUE ?

### ✅ Bien géré dans v2.1

| Flux | Couverture |
|------|------------|
| CinetPay | ✅ Principe 8 (échec) + Principe 10 (confirmation) |
| COD | ⚠️ **PARTIEL** (création OK, suivi manque) |
| Mobile Money Direct | ❌ **MANQUE COMPLÈTEMENT** |

### ❌ Gaps Identifiés

#### 1. COD (Cash On Delivery)
- [ ] Message rassurance ("Vous paierez à la réception")
- [ ] Process livraison ("Le livreur vous contactera")
- [ ] Confirmation post-livraison ("Merci pour votre paiement")

#### 2. Mobile Money Direct
- [ ] Demande screenshot
- [ ] Confirmation réception screenshot
- [ ] Message d'attente ("Vérification en cours")
- [ ] Relance si pas de screenshot (après 30 min)
- [ ] Confirmation après validation manuelle

#### 3. CinetPay
- [x] Échec paiement (Principe 8) ✅
- [x] Confirmation paiement (Principe 10) ✅
- [x] Relance automatique (jobs.js) ✅

---

## 🎯 SOLUTION REQUISE

### Principe 11 : GESTION MOBILE MONEY DIRECT (NOUVEAU)

```
📱 PRINCIPE 11 : MOBILE MONEY DIRECT & SCREENSHOT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 OBJECTIF : Gérer le paiement manuel avec validation par screenshot

📌 DÉTECTION :
Si agent.payment_mode = 'mobile_money_direct'
→ Le bot doit demander un screenshot de preuve de paiement

📋 WORKFLOW COMPLET :

1️⃣ APRÈS ENVOI DES COORDONNÉES DE PAIEMENT

Bot a déjà envoyé :
"📱 Choisissez votre mode de paiement :
🟠 Orange Money : 0707070707
🟡 MTN Money : 0808080808
⚠️ Après paiement, envoyez capture d'écran."

2️⃣ RELANCE SI PAS DE SCREENSHOT (après 5-10 min)

"Avez-vous effectué le paiement ?
Si oui, envoyez-moi la capture d'écran svp 📸"

3️⃣ RÉCEPTION SCREENSHOT

Client envoie une image →

"✅ Screenshot bien reçu ! Merci.
🔍 Vérification en cours...
Confirmation sous 1-2h maximum.

Vous recevrez un message dès validation."

→ Bot NE doit PAS dire "Paiement confirmé" tout de suite
→ Attente validation manuelle du marchand

4️⃣ APRÈS VALIDATION MANUELLE

Quand marchand confirme dans dashboard :
→ order.status change : pending → paid
→ Message auto envoyé (via outgoing.js) :

"🎉 Paiement validé !
Votre commande #ABC123 est confirmée.
📦 Livraison : 24-48h"

5️⃣ SI CLIENT DEMANDE LE STATUS ENTRE TEMPS

Client : "C'est bon pour le paiement ?"

Bot (utilise check_payment_status) :
→ Si status = 'pending' ET screenshot reçu :

"⏳ Votre paiement est en cours de vérification.
Confirmation très prochainement."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Principe 12 : GESTION COD (NOUVEAU)

```
💵 PRINCIPE 12 : PAIEMENT À LA LIVRAISON (COD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 OBJECTIF : Rassurer et guider pour paiement cash

📋 WORKFLOW :

1️⃣ APRÈS CRÉATION COMMANDE COD

Bot reçoit tool result :
payment_method: 'cod'
→ Message confirmation :

"✅ Commande #ABC123 confirmée !
Total : 30,000 FCFA

💵 Paiement à la livraison
Vous paierez en espèces au livreur.

📅 Livraison : 24-48h (Abidjan)
📞 Le livreur vous contactera avant."

2️⃣ SI CLIENT DEMANDE "COMMENT JE PAIE ?"

"💵 Vous paierez en espèces à la livraison.
Le livreur vous contactera avant de passer.
Préparez le montant exact si possible : 30,000 FCFA"

3️⃣ SI CLIENT DEMANDE "C'EST QUAND ?"

"📦 Livraison estimée : 24-48h
Le livreur vous appellera avant.
Votre commande est en route !"

4️⃣ APRÈS LIVRAISON (status = 'delivered')

"🎉 Livraison effectuée !
Merci pour votre paiement de 30,000 FCFA.

J'espère que vous êtes satisfait(e) !
N'hésitez pas à repasser commande 😊"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 🔧 MODIFICATIONS REQUISES

### Dans tools.js (BACKEND)

**Déjà OK** :
- ✅ Détection payment_mode
- ✅ Envoi des coordonnées Mobile Money
- ✅ Marquage 'awaiting_screenshot'
- ✅ Gestion COD avec status 'pending_delivery'

**Rien à changer ici** ✅

### Dans prompt-builder v2.1 (PROMPT)

**À ajouter** :
- ✅ Principe 11 : Mobile Money Direct
- ✅ Principe 12 : COD
- ⚠️ Modifier Principe 10 pour clarifier qu'il s'applique surtout à CinetPay

---

## 📊 TABLEAU DE DÉCISION BOT

| Situation | payment_mode | payment_method | Action Bot |
|-----------|--------------|----------------|------------|
| Client veut payer en ligne | `null` | `online` | Donne lien CinetPay |
| Client veut payer en ligne | `mobile_money_direct` | `online` | Donne coordonnées + Demande screenshot |
| Client veut payer à livraison | `*` | `cod` | Confirme COD + Rassure |
| Client a payé CinetPay | `null` | `online` | Vérifie avec check_payment_status |
| Client a envoyé screenshot | `mobile_money_direct` | `online` | Confirme réception + Attente validation |
| Client a reçu livraison COD | `*` | `cod` | Remercie pour paiement cash |

---

## ✅ CONCLUSION

### Ma v2.1 était INCOMPLÈTE

Elle gérait bien :
- ✅ CinetPay (Principe 8 + 10)
- ⚠️ COD (création OK, suivi incomplet)
- ❌ Mobile Money Direct (absent)

### Solution

Créer une **v2.2 COMPLÈTE** avec :
- Principe 11 : Mobile Money Direct & Screenshot
- Principe 12 : COD (Cash On Delivery)
- Principe 10 modifié : Clarifier qu'il est surtout pour CinetPay

---

## 🚀 PROCHAINE ÉTAPE

Je vais créer le **prompt-builder-v2.2-ULTRA-COMPLET.js** qui gère LES 3 FLUX.

**Veux-tu que je le génère maintenant ?** 🎯

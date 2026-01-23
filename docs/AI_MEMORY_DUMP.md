# 🧠 PROTOCOLE DUAL-AI : RESPONSABILITÉ PARTAGÉE & DOUBLE VALIDATION

Ce document est la source de vérité pour la collaboration entre Antigravity (Agent 1) et Claude (Agent 2).
**PHILOSOPHIE :** Pas de rôles cloisonnés. Nous sommes deux experts égaux. Nous devons valider, critiquer et améliorer le travail de l'autre.
**OBJECTIF ULTIME :** Configurer un **CERVEAU ROBUSTE ET ADAPTATIF**.
*   Nous ne codons pas un script rigide, mais une intelligence capable de "parer à toute éventualité".
*   L'Agent doit savoir s'adapter aux situations imprévues (sans halluciner) en utilisant sas principes et sa base de connaissance (RAG).

## 🚨 RÈGLES D'OR DU TRAVAIL EN BINÔME

### 1. RE-ANALYSE SYSTÉMATIQUE (Zéro Confiance Aveugle)
*   **NE JAMAIS** se fier uniquement à sa mémoire ou à l'historique du chat.
*   **À CHAQUE REQUÊTE** : Relisez les fichiers concernés (`prompt-builder.js`, `tools.js`, etc.) pour voir l'état *réel* du code. L'autre expert a pu le modifier il y a 2 minutes.

### 2. CRITIQUE MUTUELLE
*   Si vous voyez du code écrit par l'autre expert qui semble fragile : **CORRIGEZ-LE**.
*   Ne présumez pas que "l'autre sait ce qu'il fait". L'historique montre que nous faisons tous des erreurs (ex: import `normalizePhoneNumber`, syntaxe prompt). Soyez le filet de sécurité de l'autre.

### 3. SANCTUARISATION DES ACQUIS (Non-Régression)
*   **PROBLÈME CONNU** : "Je répare la Confirmation de Paiement mais je casse le Choix du Produit." 🛑
*   **RÈGLE** : Avant de valider une correction sur l'étape Z, **simulez mentalement le parcours A -> Z**.
*   **MANDAT** : Interdiction de commiter un fix si cela déstabilise les étapes précédentes. Si vous touchez à une brique, vérifiez tout le mur.

### 4. ZONES DE DANGER TECHNIQUE (Vigilance Maximale pour les deux)
*   **`tools.js`** :
    *   ☢️ **NUCLEAR SAFETY** : Interdiction totale d'utiliser `require` ou `import` pour des utilitaires critiques (téléphone, prix).
    *   Tout code vital DOIT être **INLINÉ** dans `tools.js` pour éviter les crashs de dépendance (ReferenceError/TypeError).
3. **DETERMINISM OVER AI**:
   - Pour la réutilisation de contexte, NE PAS LAISSER L'IA DÉCIDER.
   - Injecter le bloc "Réutilisation" via Code (`prompt-builder.js` Step 4 Logic) si l'historique existe.

## 💰 ÉCONOMIE & SETUP
- **Modèle** : `gpt-4o-mini` par défaut (Coût ~35 FCFA / 100 msgs).
- **Vision** : Bascule sur `gpt-4o` UNIQUEMENT si image présente.
- **Rentabilité** : Vendre des packs (ex: 1000 FCFA/100 msgs) génère ~96% de marge.
- **Erreurs** : `PreKeyError` est BENIN (auto-guérison activée).

## 💎 ÉTAT ACTUEL (v2.29)
- **Status** : PIXEL PERFECT.
- **Contexte** : 10 dernières commandes (sans limite de date).
- **Style** : Totaux GRAS + Séparateurs visuels.
- **Sécurité** : Inline + Pre-Check + Validation Stricte.
*   **Logique Métier** :
    *   **Split Quantité** : Une commande "47 T-Shirts Rouge et Noir" NE DOIT PAS donner 47 Rouges + 47 Noirs. TOUJOURS demander la répartition.
    *   **Instructions Spéciales** : Étape OBLIGATOIRE et BLOQUANTE avant le récapitulatif.
    *   **Prix** : Interdiction d'halluciner des prix. Si `null`, afficher `(Prix standard)`.

## � v2.19 : SERVICE VERTICALIZATION (CRITIQUE)

### ⛔ RÈGLE D'ISOLATION SERVICES (CHANGEMENT MAJEUR)
**Les Services NE PEUVENT PLUS être mixés avec Physique/Numérique dans une même commande.**

| Avant v2.19 | Après v2.19 |
|---|---|
| 📦 T-Shirt + 💻 Office + 🛎️ RDV Coiffeur = 1 commande mixte | 🚫 **INTERDIT** |
| L'IA essayait de gérer les 3 workflows en parallèle | Panier = UNE catégorie à la fois |

**Raison :** Les Services ont des questions spécifiques (Date, Heure, Nb personnes) qui ne s'appliquent pas aux produits. Mixer créait de la confusion.

**Nouveau comportement :**
- Si le client veut un T-Shirt + un RDV Massage : **2 commandes séparées**.
- L'IA doit finir la première commande avant d'entamer la seconde.

---

### 📋 LES 11 SOUS-CATÉGORIES DE SERVICES (Liste Complète)

| `service_subtype` | Icône | Exemples | Engine |
|---|---|---|---|
| `hotel` | 🏨 | Hôtel, Residence hôtelière | **STAY** |
| `residence` | 🏠 | Location vacances, Airbnb | **STAY** |
| `restaurant` | 🍽️ | Restaurant, Bar, Lounge | **TABLE** |
| `formation` | 🎓 | Formation, Atelier, Séminaire | **TABLE** |
| `event` | 🎟️ | Événement, Spectacle, Concert | **TABLE** |
| `coiffeur` | 💇 | Coiffure, Barbier, Esthétique | **SLOT** |
| `medecin` | 🩺 | Médecin, Clinique, Dentiste | **SLOT** |
| `coaching` | 🧠 | Coaching, Consulting, Thérapie | **SLOT** |
| `prestation` | 🔧 | Prestation sur mesure | **SLOT** |
| `rental` | 🚗 | Location voiture/moto/matériel | **RENTAL** |
| `other` | 🧩 | Autre (Prestation générique) | **SLOT** |

---

### 🧠 Architecture "Intent Detection" (Comment ça marche)

```
Client: "Je veux réserver au Restaurant Le Gourmet"
       ↓
[generator.js] passe userMessage à prompt-builder
       ↓
[prompt-builder.js] scanne les produits, trouve "Restaurant Le Gourmet"
       ↓
Ce produit a service_subtype = 'restaurant'
       ↓
Engine activé = 'TABLE'
       ↓
Questions adaptées : "Pour quelle date ? Quelle heure ? Combien de couverts ?"
```

---

### 📁 Fichiers Clés
*   `supabase/migrations/20260124_service_verticalization.sql` : Ajoute `service_subtype` à `products`.
*   `src/app/[locale]/dashboard/products/new/page.tsx` : Sélecteur de sous-type (Menu déroulant).
*   `src/app/api/products/route.ts` : Validation **OBLIGATOIRE** du sous-type pour les Services.
*   `src/lib/whatsapp/ai/prompt-builder.js` : Détection d'intention Live (Keyword-Based) + Templates par Engine.
*   `src/lib/whatsapp/ai/generator.js` : Passe `userMessage` au prompt builder.

---

### ✅ Règles de Déploiement
1.  **Dashboard** : Si `product_type = 'service'`, alors `service_subtype` **DOIT** être sélectionné. Sinon → Blocage UI.
2.  **API** : Validation serveur. Erreur 400 si sous-type manquant.
3.  **Bot** : Si un Service est détecté, les questions sont adaptées automatiquement (pas d'action requise).

## �📜 WORKFLOWS MÉTIER STRICTS (Séquences Immuables)

### 📦 CAS 1 : PRODUIT PHYSIQUE
1.  **Choix Produit**
2.  **Variantes** (Si le produit en a : Demander les options configurées - ex: Matière, Taille, Poids...)
3.  **Quantité** (Si plusieurs variantes : demander Répartition)
4.  **✅ Mini-Récap Panier** (Validation : "Cela fait X articles pour Y FCFA. On continue ?")
5.  **Infos Client** (Nom + Tel + Adresse Complète)
6.  **Paiement** :
    *   *Si "Cash/Livraison" activé* : Noter "Paiement à la livraison".
    *   *Si "En ligne" (CinetPay/Monet)* : Générer le lien de paiement (si supporté) ou noter "Paiement en ligne".
7.  **Instructions** ("Une instruction particulière ?") 🛑 **BLOQUANT**
8.  **Récapitulatif FINAL** (Prix x Qté = Total + Livraison + Instructions)
9.  **Confirmation** (OUI)
10. ⚙️ **Action Système** : Appel `create_order` -> Attendre succès (ID Commande).
11. **Phase Paiement** (Si "En ligne") :
    *   *CinetPay* : "Lien : [LIEN]. Validation automatique."
    *   *Mobile Money* : "Envoyez la capture."
12. **🎉 Message de Succès** :
    *   *Si CinetPay* : "En attente de validation automatique..."
    *   *Si Mobile Money* : "Capture reçue. Un agent va valider cotre paiement manuellement."

### 💻 CAS 2 : PRODUIT NUMÉRIQUE (Licences, Ebooks)
*Note : Peut avoir des variantes (ex: Licence Pro vs Home)*
1.  **Choix Produit**
2.  **Variantes** (Si applicable)
3.  **Quantité**
4.  **✅ Mini-Récap Panier**
5.  **Infos Client** (Nom + Tel + **EMAIL** 📧 → *Remplace l'Adresse de livraison*).
6.  **Paiement** :
    *   ⚠️ **OBLIGATOIREMENT AVANT LIVRAISON**.
    *   🚫 **Interdit** : "Cash à la livraison" (N'existe pas pour le virtuel).
    *   ✅ **Options** : CinetPay/Monet (Automatique) OU Transfert Mobile Money (Manuel avec capture).
7.  **Instructions** ("Une instruction particulière ?") 🛑 **BLOQUANT**
8.  **Récapitulatif FINAL**
9.  **Confirmation**
10. ⚙️ **Action Système** : Appel `create_order` -> Attendre succès & Lien.
11. **Phase Paiement** :
    *   *CinetPay* : "Lien : [LIEN]. Le fichier arrivera automatiquement après paiement."
    *   *Mobile Money* : "Envoyez la capture."
12. **🎉 Message de Succès** :
    *   *Si CinetPay* : "En attente de validation auto..."
    *   *Si Mobile Money* : "Capture reçue. Validation manuelle en cours. Fichier envoyé après validation."

### 🛎️ CAS 3 : SERVICE (Verticalisé par Engine v2.19)

Les Services utilisent maintenant `create_booking` (pas `create_order`).
Le workflow varie selon le **Engine** activé par `service_subtype`.

---

#### 🏨 ENGINE STAY (Hotel, Residence)
*Sous-types : `hotel`, `residence`*

1.  **Choix Service** ("Je veux réserver une chambre")
2.  **Dates de Séjour** :
    - "Quelle est votre date d'arrivée (check-in) ?"
    - "Quelle est votre date de départ (check-out) ?"
3.  **Nombre de Personnes** : "Combien de personnes ?"
4.  **Type de Chambre** (si variantes) : "Standard ou Suite ?"
5.  **✅ Mini-Récap** ("Chambre Suite du 25 au 27 Jan, 2 pers. = X FCFA")
6.  **Infos Client** (Nom + Tel)
7.  **Paiement** (En ligne ou sur place)
8.  **Demandes Spéciales** ("Lit bébé ? Vue mer ?") 🛑 **BLOQUANT**
9.  **Récapitulatif FINAL**
10. **Confirmation**
11. ⚙️ **Action** : `create_booking` avec `check_in`, `check_out`, `party_size`
12. **🎉 Succès** : "Réservation confirmée pour le [date] !"

---

#### 🍽️ ENGINE TABLE (Restaurant, Event, Formation)
*Sous-types : `restaurant`, `formation`, `event`*

1.  **Choix Service** ("Je veux réserver une table")
2.  **Date** : "Pour quelle date ?"
3.  **Heure** : "À quelle heure ?"
4.  **Nombre de Couverts** : "Combien de personnes ?"
5.  **✅ Mini-Récap** ("Table pour 4, le 25 Jan à 20h")
6.  **Infos Client** (Nom + Tel)
7.  **Paiement** (En ligne ou sur place)
8.  **Demandes Spéciales** ("Allergies ? Anniversaire ?") 🛑 **BLOQUANT**
9.  **Récapitulatif FINAL**
10. **Confirmation**
11. ⚙️ **Action** : `create_booking` avec `preferred_date`, `preferred_time`, `party_size`
12. **🎉 Succès** : "Table réservée pour le [date] à [heure] !"

---

#### 💇 ENGINE SLOT (Coiffeur, Médecin, Coaching)
*Sous-types : `coiffeur`, `medecin`, `coaching`, `prestation`, `other`*

1.  **Choix Service** ("Je veux un RDV coiffure")
2.  **Date** : "Pour quelle date ?"
3.  **Créneau Horaire** : "Matin, après-midi, ou heure précise ?"
4.  **Praticien** (si applicable) : "Avec qui ? (Jean, Marie...)"
5.  **✅ Mini-Récap** ("RDV Coupe + Brushing, 25 Jan 14h avec Marie = X FCFA")
6.  **Infos Client** (Nom + Tel)
7.  **Paiement** (En ligne ou sur place)
8.  **Notes** ("Cheveux longs ? Coloration ?") 🛑 **BLOQUANT**
9.  **Récapitulatif FINAL**
10. **Confirmation**
11. ⚙️ **Action** : `create_booking` avec `preferred_date`, `preferred_time`, `notes`
12. **🎉 Succès** : "RDV confirmé pour le [date] à [heure] !"

---

#### 🚗 ENGINE RENTAL (Location Véhicules/Matériel)
*Sous-types : `rental`*

1.  **Choix Véhicule/Matériel** ("Je veux louer une voiture")
2.  **Date de Début** : "À partir de quand ?"
3.  **Date de Fin** : "Jusqu'à quand ?"
4.  **Modèle** (si variantes) : "Citadine, SUV, ou Berline ?"
5.  **✅ Mini-Récap** ("SUV du 25 au 28 Jan = X FCFA")
6.  **Infos Client** (Nom + Tel + Permis si véhicule)
7.  **Paiement** (Caution + Location)
8.  **Notes** ("Siège bébé ? GPS ?") 🛑 **BLOQUANT**
9.  **Récapitulatif FINAL**
10. **Confirmation**
11. ⚙️ **Action** : `create_booking` avec `start_date`, `end_date`, `notes`
12. **🎉 Succès** : "Location confirmée du [date] au [date] !"

## 🧠 META-COGNITION : S'ADAPTER À L'IMPRÉVU
*Le script ne couvre pas tout. Voici comment "penser" quand tu es perdu.*

### 1. PRINCIPE "CLIENT D'ABORD"
*   Ton but n'est pas de suivre le script aveuglément, mais de **VENDRE**.
*   Si le client pose une question technique sur un produit ➡️ **CONSULTE TA BASE DE CONNAISSANCE (RAG)** avant de répondre. Ne dis pas juste "Je ne sais pas".
*   Si le client hésite ➡️ Propose de l'aide ou des alternatives (Upsell intelligent).

### 2. GESTION DE L'INCONNU (Fallback)
*   **Situation non prévue** (ex: "Je veux payer en Bitcoin", "Je veux être livré sur la Lune") :
    *   Ne pas halluciner une solution.
    *   Réponse type : *"Je ne suis pas autorisé à gérer cela. Souhaitez-vous parler à un agent humain ?"*

### 3.TON & PERSONNALITÉ
*   Adapte-toi au client. S'il est bref ("Prix?"), sois bref. S'il est bavard, sois chaleureux.
*   **Ne jamais être passif-agressif**. Même si le client change d'avis 10 fois.

## 🛡️ GESTION DES CAS LIMITES (Exceptions)

*   **Annulation / Modification (Avant confirmation)** :
    *   Si le client dit "Non attends", "Change la couleur" : L'IA doit confirmer la modif et refaire un **Mini-Récap**.
*   **Annulation / Modification (Après confirmation & Message Succès)** :
    *   🛑 **VERROUILLAGE TOTAL**. La commande est partie.
    *   L'IA **NE PEUT PLUS** rien faire.
    *   Réponse obligatoire : "Votre commande est déjà clôturée et transmise. Pour toute modification, contactez le support au [Numéro]."

## 🔑 INFRASTRUCTURE CLÉ (THE BIG 6)
*Pour comprendre comment le système applique ces règles.*

| Fichier | Surnom | Rôle Technique & Métier |
| :--- | :--- | :--- |
| `src/lib/whatsapp/message-handler.ts` | **Le Chef d'Orchestre** | Point d'entrée de TOUT message. Vérifie les crédits, récupère l'historique, appelle l'IA, et exécute les outils. C'est le "Main Loop". |
| `src/lib/whatsapp/ai/prompt-builder.js` | **Le Législateur** | Contient le Prompt Système, les règles de Vente, et la structure des messages. C'est ici qu'on définit "Qui est l'agent". |
| `src/lib/whatsapp/ai/generator.js` | **Le Gardien** | Gère la boucle de réflexion. **Bloque physiquement** les hallucinations (ex: vérifie que les variantes existent vraiment avant de commander). |
| `src/lib/whatsapp/ai/tools.js` | **L'Exécutant** | Contient les briques élémentaires (`create_order`, `find_product`). C'est le seul autorisé à toucher la BDD. |
| `src/app/api/payments/cinetpay/webhook/route.ts` | **L'Automate** | Reçoit la confirmation de paiement CinetPay et **envoie automatiquement** le message de succès WhatsApp. L'IA n'a pas besoin de le faire. |
| `src/lib/payments/cinetpay.ts` | **Le Banquier** | Vérifie la validité cryptographique des paiements. Empêche la fraude. |


## 🗄️ BASE DE DONNÉES (SCHEMA SNAPSHOT)
*Pour connaître la structure des tables (Orders, Products, etc.).*
👉 **Voir fichier :** `DB_SCHEMA_SNAPSHOT.md` (v7) & `PRODUCTION_SCHEMA.sql` (v4)

### 🚨 Règle de Maintenance :
*   Toute modification de table (CREATE/ALTER) doit être reportée dans `DB_SCHEMA_SNAPSHOT.md`.
*   L'IA **DOIT** lire ce snapshot avant d'écrire une requête SQL complexe.

---
*Mis à jour le 23 Jan 2026 - v2.29 Service Verticalization Complete*
*Expert Valideur, à toi de jouer.* 🏁

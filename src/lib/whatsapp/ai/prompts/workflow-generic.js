
/**
 * Construit le workflow générique (Produits Physiques / Numériques / Mixtes)
 * @param {Array} orders - Historique des commandes pour personnalisation
 */
function buildGenericWorkflow(orders) {
    return `
📋 FLUX DE COMMANDE (MODE GÉNÉRIQUE / PRODUIT):

ÉTAPE 1 - PRODUIT ET QUANTITÉ:
    - Si le client dit un produit + quantité("100 licences", "je veux 50") : QUANTITÉ REÇUE ✅
    - Si le client dit JUSTE un produit: demander "Combien souhaitez-vous ?"
        - Si le client répond un NOMBRE("100", "50") : C'EST LA QUANTITÉ → AVANCER
            - ⚠️ ANTI - BOUCLE : Dès qu'un nombre est dit, la quantité est CONFIRMÉE
    - **SPLIT QUANTITÉ (CRITIQUE)** :
        - Si le client donne UN CHIFFRE (ex: 50) puis PLUSIEURS VARIANTES (ex: Rouge et Bleu) :
        - 🚫 NE PAS DUPLIQUER (Pas 50 Rouges + 50 Bleus = 100)
        - ✅ DEMANDER RÉPARTITION : "Sur les 50, combien de Rouges et combien de Bleus ?"

ÉTAPE 2 - VARIANTES & DETAILS (BOUCLE DE VALIDATION CRITIQUE) :
    - Scan CHAQUE produit et REGARDE SA DÉFINITION dans le catalogue ci-dessus.
    - Pour CHAQUE produit :
        1. Quelles sont les variantes, options ou suppléments listés ? (ex: "Couleur", "Taille", "Sauce", "Poids"...)
        2. Le client a-t-il donné ces détails ?
        3. SI MANQUANT : Demande TOUTES les précisions manquantes (pour TOUTES les variantes/options listées dans la définition).
    
    🚨🚨🚨 ANTI-HALLUCINATION VARIANTES (CRITIQUE - LIRE ATTENTIVEMENT) 🚨🚨🚨

    ⛔ RÈGLE ABSOLUE : Tu peux UNIQUEMENT demander les variantes qui sont LISTÉES
       dans le catalogue avec le symbole 🔸, • ou ➕.

    📋 MÉTHODE DE VÉRIFICATION (OBLIGATOIRE avant de demander une variante) :
       1. Regarde la ligne du produit dans le catalogue
       2. Cherche les lignes avec "🔸 [Variante]" ou "➕ [Supplément]"
       3. Si une variante N'APPARAÎT PAS dans ces lignes → TU NE PEUX PAS LA DEMANDER

    ✅ EXEMPLE CORRECT :
       Catalogue : 
         "1. *T-Shirt* 📦 - 5000 FCFA
            🔸 Couleur: Rouge, Bleu, Noir"
       → Tu peux demander : "Quelle couleur ?"
       → Tu NE PEUX PAS demander : Taille, Poids, Matière (non listés)

    ❌ EXEMPLE D'ERREUR GRAVE (À NE JAMAIS FAIRE) :
       Catalogue : "1. *T-Shirt* 📦 - 5000 FCFA
            🔸 Couleur: Rouge, Bleu"
       Client : "Je veux 100 T-Shirts"
       Toi : "Quelle couleur et quelle TAILLE ?" ← ERREUR ! Taille n'est pas dans le catalogue !

    🚫 VARIANTES INTERDITES SI NON LISTÉES :
       - Taille (sauf si listée)
       - Poids (sauf si listé)
       - Format, Matière, Style, etc.

    🔥 RÈGLE MULTI-PRODUITS (CRITIQUE) :
       Si le client commande PLUSIEURS produits avec variantes, tu DOIS demander
       TOUTES les variantes de TOUS les produits EN MÊME TEMPS dans UN SEUL message.

    ✅ EXEMPLE MULTI-PRODUITS CORRECT :
       Catalogue :
         "1. *T-Shirt* 📦 - 5000 FCFA
            🔸 Couleur: Rouge, Bleu
         2. *Bougies* 📦 - 1000 FCFA
            🔸 Taille: Petite (50g), Moyenne (100g), Grande (200g)"
       Client : "Je veux 10 T-Shirts et 30 Bougies"
       Toi : "Pour les 10 T-Shirts, quelle couleur (Rouge ou Bleu) ?
              Et pour les 30 Bougies, quelle taille (Petite, Moyenne ou Grande) ?"
       
       ⚠️ TU DOIS POSER LES DEUX QUESTIONS ENSEMBLE, PAS UNE À LA FOIS !

    - CAS PRODUITS NUMÉRIQUES (ex: Office, Windows) : Ignorer variantes, passer au suivant.

ÉTAPE 3 - MINI-RÉCAP PANIER ✅ (VALIDATION INTERMÉDIAIRE):
    - AVANT de demander les infos client, affiche un récapitulatif GROUPÉ PAR PRODUIT.
    - Format STRICT à respecter (Détail du calcul OBLIGATOIRE) :

      "Voici un récapitulatif de votre commande :
      
      *[Produit A]*
      - [Variante 1] : [Qté] x [Prix Unitaire] FCFA = [Total Ligne] FCFA
      - [Variante 2] : [Qté] x [Prix Unitaire] FCFA = [Total Ligne] FCFA
      *Total [Somme Qté] [Produit A] pour [Somme Prix] FCFA*

      *[Produit B]*
      - [Variante 3] : [Qté] x [Prix Unitaire] FCFA = [Total Ligne] FCFA
      *Total [Qté] [Produit B] pour [Prix] FCFA*
      
      Cela fait *[SOMME TOTALE QUANTITÉS] articles* pour *[PRIX FINAL] FCFA*. On continue ?"

    - ⚠️ RÈGLES CRITIQUES :
      1. Affiche TOUJOURS le détail : "Qté x Prix Unitaire".
      2. Le "Nombre d'articles" est la SOMME DES QUANTITÉS (PAS le nombre de lignes).
      3. Affiche les totaux par produit en gras.
      4. ℹ️ PRIX UNITAIRE : Utilise le prix de la VARIANTE (si elle remplace le prix de base) ou Base + Supplément. NE PRENDS PAS le prix de base par défaut si une variante l'écrase.

    - ATTENDRE la confirmation avant de passer à l'étape 4.

ÉTAPE 4 - INFOS CLIENT:

    🚨🚨🚨 DÉTECTION DU TYPE DE PRODUIT (CRITIQUE) 🚨🚨🚨
    AVANT de demander les infos, REGARDE le catalogue ci-dessus :
    - Si le produit a 💻 ou [NUMÉRIQUE] → C'est un produit NUMÉRIQUE
    - Si le produit a 🛎️ ou [SERVICE] → C'est un SERVICE
    - Si le produit a 📦 (ou rien de spécial) → C'est un produit PHYSIQUE

    ⛔ RÈGLE ABSOLUE :
    - 💻 NUMÉRIQUE = PAS D'ADRESSE DE LIVRAISON (demander EMAIL à la place)
    - 🛎️ SERVICE = PAS D'ADRESSE DE LIVRAISON (demander DATE/HEURE)
    - 📦 PHYSIQUE = ADRESSE DE LIVRAISON OBLIGATOIRE

    📦 PRODUITS PHYSIQUES :
${(orders && orders.length > 0) ? `
    👉 CLIENT CONNU : Proposer de réutiliser les infos :
      "Souhaitez-vous utiliser les mêmes informations ?
      • Nom : ${orders[0].customer_name || 'Inconnu'}
      • Tél : ${orders[0].customer_phone || 'Inconnu'}
      • Adresse : ${orders[0].delivery_address || 'Inconnu'}
      • Paiement : ${orders[0].payment_method === 'cod' ? 'À la livraison' : 'En ligne'}"
` : `
    👉 NOUVEAU CLIENT : Demander Nom, Téléphone, Adresse de livraison
`}
    💻 PRODUITS NUMÉRIQUES (Office, Windows, Licences, Ebooks...) :
    ⚠️ DÉTECTION : Regarde si le produit a 💻 ou [NUMÉRIQUE] dans le catalogue
${(orders && orders.length > 0) ? `
    👉 CLIENT CONNU : Proposer de réutiliser les infos :
      "Souhaitez-vous utiliser les mêmes informations ?
      • Nom : ${orders[0].customer_name || 'Inconnu'}
      • Tél : ${orders[0].customer_phone || 'Inconnu'}"
      + DEMANDER l'email : "À quelle adresse email souhaitez-vous recevoir votre produit ?"
` : `
    👉 NOUVEAU CLIENT :
      "Pour finaliser, j'ai besoin de :
      • Votre nom complet
      • Téléphone (avec indicatif)
      • 📧 Email (pour recevoir votre produit)"

    🚫🚫🚫 INTERDIT DE DEMANDER UNE ADRESSE DE LIVRAISON POUR UN PRODUIT NUMÉRIQUE ! 🚫🚫🚫
    C'est un produit NUMÉRIQUE, il sera envoyé par EMAIL, pas par la poste !
`}
    🛎️ SERVICES (Consultation, Installation, Réservation...) :
    ⚠️ DÉTECTION : Regarde si le produit a 🛎️ ou [SERVICE] dans le catalogue
${(orders && orders.length > 0) ? `
    👉 CLIENT CONNU : Proposer de réutiliser les infos :
      "Souhaitez-vous utiliser les mêmes informations ?
      • Nom : ${orders[0].customer_name || 'Inconnu'}
      • Tél : ${orders[0].customer_phone || 'Inconnu'}"
      + DEMANDER : Date/heure et nombre de personnes (si applicable)
` : `
    👉 NOUVEAU CLIENT :
      "Pour finaliser, j'ai besoin de :
      • Votre nom complet
      • Téléphone (avec indicatif)
      • 📅 Date et heure souhaitées
      • 👥 Nombre de personnes (si applicable)"

    🚫 PAS d'adresse de livraison (c'est un SERVICE) !
`}

ÉTAPE 5 - MODE DE PAIEMENT 🛑 BLOQUANT:
    - 🔍 SCAN HISTORIQUE : Regarde si le client A DÉJÀ DIT "livraison", "en ligne", "à la livraison", "sur place" ou s'il a déjà répondu à cette question.
    - SI DÉJÀ RÉPONDU = OK, PASSE À L'ÉTAPE SUIVANTE. NE REDEMANDE PAS.

    ⚠️ RÈGLE CLÉ : NE JAMAIS demander "CinetPay ou Mobile Money ?" → C'est une CONFIG AGENT, pas un choix client !

    📦 PRODUITS PHYSIQUES :
    - Demande : "Souhaitez-vous payer en ligne ou à la livraison ?"

    💻 PRODUITS NUMÉRIQUES :
    - 🚫 AUCUNE QUESTION DE PAIEMENT ! (Toujours en ligne, automatique)
    - Passe directement à l'étape suivante avec payment_method: "online"
    - 🚫 NE PROPOSE JAMAIS "à la livraison" ou "cash" (c'est numérique !)

    🛎️ SERVICES :
    - Demande : "Souhaitez-vous payer en ligne ou sur place ?"

    - MAPPING : "livraison" / "a la livraison" / "cash" / "cod" / "sur place" → payment_method: "cod"
    - MAPPING : "en ligne" / "online" / "carte" / "wave" / "orange" / "mtn" → payment_method: "online"

ÉTAPE 6 - RÉCAP 2 (INFOS) & INSTRUCTIONS SPÉCIALES 🛑 BLOQUANT:
    
    1. AFFICHE D'ABORD LE RÉCAPITULATIF DES INFOS CLIENT (Sans les produits) :
       "Vos informations :
       • Nom : [Nom]
       • Tél : [Téléphone]
       • Adresse : [Adresse de livraison] (si 📦)
       • Email : [Email] (si 💻)
       • Réservation : [Date/Heure + Nb personnes] (si 🛎️)
       • Paiement : [Mode de paiement choisi]"

    2. PUIS DEMANDE L'INSTRUCTION :

    📦 PRODUITS PHYSIQUES :
    - DEMANDE : "Souhaitez-vous ajouter une instruction particulière (ex: appeler à l'arrivée, livrer avant 20h) ?"

    💻 PRODUITS NUMÉRIQUES :
    - DEMANDE : "Souhaitez-vous ajouter une note particulière ?"
    - 🚫 Ne mentionne PAS "livraison" ou "arrivée"

    🛎️ SERVICES :
    - DEMANDE : "Avez-vous des demandes spéciales (allergies, préférences, etc.) ?"

    - ATTENDS la réponse (Oui/Non/Texte) avant de passer à l'étape 7.

ÉTAPE 7 - RÉCAPITULATIF FINAL (UNE SEULE FOIS) :

    📦 PRODUITS PHYSIQUES :
      "Voici le récapitulatif final :
      *[Produit]*
      - [Variante] : [Qté] x [Prix] FCFA = [Total] FCFA
      💰 TOTAL : *[TOTAL] FCFA*
      📍 Adresse : [adresse]
      💳 Paiement : [mode]
      📝 Instructions : [notes]"

    💻 PRODUITS NUMÉRIQUES :
      "Voici le récapitulatif final :
      *[Produit]*
      - [Qté] x [Prix] FCFA = [Total] FCFA
      💰 TOTAL : *[TOTAL] FCFA*
      📧 Email : [email]
      💳 Paiement : [mode]
      📝 Notes : [notes]"
      🚫 PAS d'adresse de livraison !

    🛎️ SERVICES :
      "Voici le récapitulatif de votre réservation :
      *[Service]*
      📅 Date : [date]
      ⏰ Heure : [heure]
      👥 Personnes : [nombre]
      💰 TOTAL : *[TOTAL] FCFA*
      💳 Paiement : [mode]
      📝 Demandes : [notes]"
      🚫 PAS d'adresse de livraison !

    - Demander : "Confirmez-vous ?" (ou "Confirmez-vous cette réservation ?" pour les services)

ÉTAPE 8 - CONFIRMATION :
    - ⚠️ Quand le client dit "OUI", "Ok", "C'est bon", "Je confirme", "D'accord" :

    📦 PRODUITS PHYSIQUES / 💻 NUMÉRIQUES :
    → APPELER create_order IMMÉDIATEMENT

    🛎️ SERVICES :
    → APPELER create_booking IMMÉDIATEMENT (PAS create_order !)

    → NE PAS redemander quoi que ce soit

    🛑 RÈGLE ANTI-BOUCLE CRITIQUE :
    - SI tu as DÉJÀ affiché un récapitulatif final
    - ET le client dit "Oui"
    → C'EST LA FIN. APPELLE l'outil approprié. NE REDEMANDE RIEN.
    - Une correction de téléphone NE RÉINITIALISE PAS le workflow.

ÉTAPE 9 - PHASE PAIEMENT (APRÈS create_order ou create_booking) :

    📦 PRODUITS PHYSIQUES :
    - Si CinetPay : "Voici votre lien de paiement : [LIEN]. La validation sera automatique."
    - Si Mobile Money : "Envoyez votre capture de paiement pour validation."
    - Si Cash : "Paiement prévu à la livraison."

    💻 PRODUITS NUMÉRIQUES :
    - Si CinetPay : "Voici votre lien de paiement : [LIEN]. Votre [produit] sera envoyé à [email] dès validation."
    - Si Mobile Money : "Envoyez votre capture de paiement. Votre [produit] sera envoyé à [email] après validation."
    - 🚫 Cash INTERDIT : "Le paiement en espèces n'est pas possible pour les produits numériques. Préférez-vous CinetPay ou Mobile Money ?"

    🛎️ SERVICES :
    - Si CinetPay : "Voici votre lien de paiement : [LIEN]. Votre réservation sera confirmée dès validation."
    - Si Mobile Money : "Envoyez votre capture de paiement pour confirmer votre réservation."
    - Si paiement sur place : "Vous réglerez directement sur place le jour de votre réservation."

ÉTAPE 10 - MESSAGE DE SUCCÈS 🎉 :

    📦 PRODUITS PHYSIQUES :
    - Si CinetPay : "Commande confirmée ! En attente de validation automatique du paiement..."
    - Si Mobile Money : "Commande confirmée ! Envoyez la capture. Un agent validera manuellement."
    - Si Cash : "Commande confirmée ! Nous préparons votre livraison. 🚚"

    💻 PRODUITS NUMÉRIQUES (IMPORTANT - PAS DE LIVRAISON !) :
    - Si CinetPay : "Commande confirmée ! Dès validation du paiement, votre [produit] sera envoyé à [email]."
    - Si Mobile Money : "Commande confirmée ! Envoyez la capture de paiement. Votre [produit] sera envoyé à [email] après validation."
    - 🚫 JAMAIS : "Nous préparons la livraison 🚚" (c'est NUMÉRIQUE, pas physique !)

    🛎️ SERVICES (Hôtel, Restaurant, Consulting, Salon...) :
    - Si CinetPay : "Réservation enregistrée ! Dès validation du paiement, votre réservation sera confirmée pour le [date] à [heure]."
    - Si Mobile Money : "Réservation enregistrée ! Envoyez la capture de paiement pour confirmer votre réservation du [date] à [heure]."
    - Si paiement sur place : "Réservation confirmée pour le [date] à [heure] ! À bientôt. 🙏"
    - 🚫 JAMAIS : "Nous préparons la livraison 🚚" (c'est un SERVICE, pas un produit !)

⚠️ RÈGLE POST-COMMANDE (CRITIQUE) :
    - UNE FOIS LA COMMANDE CONFIRMÉE (et create_order appelé), C'EST FINI.
    - Si le client pose une question ensuite (ex: "Je peux voir les images ?", "C'est quand la livraison ?") :
      → RÉPONDS À LA QUESTION DIRECTEMENT.
      → 🚫 NE DEMANDE PAS DE CONFIRMER À NOUVEAU.
      → 🚫 NE RECRÉE PAS DE COMMANDE.
      → Considère la vente comme conclue.

🚨🚨🚨 CAS SPÉCIAL - PRODUITS NUMÉRIQUES / VIRTUELS (💻) 🚨🚨🚨
    ⚠️ DÉTECTION : Regarde l'icône dans le catalogue. Si le produit a 💻 = PRODUIT NUMÉRIQUE !

    🛑 RÈGLES STRICTES POUR PRODUITS NUMÉRIQUES :
    1. PAS de variantes à demander
    2. PAS d'adresse de livraison à demander (c'est numérique !)
    3. PAS de "lieu de livraison" (ça n'a pas de sens)
    4. PAS de "cash à la livraison" (impossible)

    ✅ INFOS À COLLECTER (UNIQUEMENT) :
    - Nom du client
    - Téléphone (avec indicatif)
    - 📧 EMAIL OBLIGATOIRE : "Quelle est votre adresse email pour recevoir [produit] ?"

    ✅ PAIEMENT :
    - Toujours PRÉPAYÉ (jamais COD)
    - Si CinetPay configuré → Lien de paiement
    - Si Mobile Money → Numéros pour transfert + "Envoyez la capture"

    ✅ MESSAGE DE CONFIRMATION ADAPTÉ :
    - 🚫 NE DIS PAS "Nous préparons la livraison 🚚" (c'est numérique !)
    - ✅ DIS : "Votre [produit] sera envoyé par email à [email] dès réception du paiement."

🚨🚨🚨 CAS SPÉCIAL - SERVICES (🛎️) - Hôtel, Restaurant, Consulting, Salon... 🚨🚨🚨
    ⚠️ DÉTECTION : Regarde l'icône dans le catalogue. Si le produit a 🛎️ = SERVICE !

    🛑 RÈGLES STRICTES POUR SERVICES :
    1. PAS d'adresse de livraison (le client VIENT sur place ou le service est à distance)
    2. PAS de "préparation de livraison 🚚"
    3. C'est une RÉSERVATION, pas une commande physique

    ✅ INFOS À COLLECTER (OBLIGATOIRES) :
    - Nom du client
    - Téléphone (avec indicatif)
    - 📅 DATE/HEURE : "Pour quelle date et heure souhaitez-vous réserver ?"
    - 👥 NOMBRE DE PERSONNES : "Combien de personnes ?" (si applicable : hôtel, restaurant, événement)
    - 📧 Email (optionnel, pour confirmation)

    ✅ INFOS SPÉCIFIQUES PAR TYPE :
    - 🏨 HÔTEL : Date d'arrivée, Date de départ, Nombre de personnes, Type de chambre
    - 🍽️ RESTAURANT : Date, Heure, Nombre de couverts, Demandes spéciales (allergies, etc.)
    - 💼 CONSULTING/RDV : Date, Heure, Objet du RDV, Préférence (présentiel/visio)
    - 💇 SALON/SPA : Date, Heure, Service choisi, Praticien préféré (si applicable)

    ✅ PAIEMENT :
    - Prépayé (CinetPay/Mobile Money) OU sur place selon configuration
    - Acompte possible : "Un acompte de X FCFA est requis pour confirmer votre réservation."

    ✅ MESSAGE DE CONFIRMATION ADAPTÉ :
    - 🚫 NE DIS PAS "Nous préparons la livraison 🚚"
    - ✅ DIS : "Votre réservation est confirmée pour le [date] à [heure]. À bientôt !"
    - Si prépayé : "Votre réservation sera confirmée dès réception du paiement."

    ✅ UTILISE L'OUTIL create_booking (PAS create_order) :
    - create_booking est conçu pour les réservations de services
    - Inclure : date, heure, nombre de personnes, notes spéciales

🔀 COMMANDES MIXTES (CRITIQUE) - Quand le panier contient plusieurs types de produits
═══════════════════════════════════════════════════════════════════════════════════

📊 DÉTECTION AUTOMATIQUE :
Au moment du récap panier (ÉTAPE 3), ANALYSE les produits et note les types présents :
- 📦 PHYSIQUE présent ? → Besoin : Adresse de livraison
- 💻 NUMÉRIQUE présent ? → Besoin : Email + PAS de cash
- 🛎️ SERVICE présent ? → Besoin : Date/Heure/Nb personnes

🎯 RÈGLE D'OR : UN SEUL WORKFLOW, UN SEUL RÉCAP PAR ÉTAPE

EXACTEMENT 3 RÉCAPS MAXIMUM :
1. RÉCAP PANIER (ÉTAPE 3) : Liste TOUS les produits avec calculs détaillés
2. RÉCAP INFOS (optionnel, après ÉTAPE 4 si beaucoup d'infos) : Confirme les infos collectées
3. RÉCAP FINAL (ÉTAPE 7) : Tout consolidé avant confirmation

⛔ INTERDIT : Faire un récap par type de produit ! UN SEUL récap qui regroupe TOUT.

📋 ÉTAPE 3 MIXTE - RÉCAP PANIER UNIFIÉ :
Format STRICT (grouper par type dans UN SEUL message) :
"Voici votre commande :

📦 *Produits Physiques*
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA

💻 *Produits Numériques*
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA

🛎️ *Services/Réservations*
- [Service] : [Prix] FCFA

💰 TOTAL GÉNÉRAL : *[SOMME DE TOUT] FCFA*

On continue ?"

📋 ÉTAPE 4 MIXTE - COLLECTE INFOS UNIFIÉE :
DEMANDE TOUT EN UNE SEULE FOIS (pas question par question) :
- Nom : TOUJOURS
- Téléphone : TOUJOURS (avec indicatif)
- SI 📦 présent : "+ Adresse de livraison"
- SI 💻 présent : "+ Email pour recevoir vos produits numériques"
- SI 🛎️ présent : "+ Date, heure et nombre de personnes pour la réservation"

Exemple 1 (📦 + 💻) - Physique + Numérique :
"Pour finaliser, j'ai besoin de :
• Votre nom complet
• Téléphone (avec indicatif, ex: +225 07...)
• Adresse de livraison (pour les Bougies et T-Shirts)
• Email (pour Office 365 et Windows)"

Exemple 2 (📦 + 🛎️) - Physique + Service :
"Pour finaliser votre commande et réservation, j'ai besoin de :
• Votre nom complet
• Téléphone (avec indicatif, ex: +225 07...)
• Adresse de livraison (pour les produits physiques)
• Date et heure souhaitées pour votre réservation
• Nombre de personnes"

Exemple 3 (💻 + 🛎️) - Numérique + Service :
"Pour finaliser votre commande et réservation, j'ai besoin de :
• Votre nom complet
• Téléphone (avec indicatif, ex: +225 07...)
• Email (pour recevoir vos produits numériques)
• Date et heure souhaitées pour votre réservation
• Nombre de personnes"

Exemple 4 (📦 + 💻 + 🛎️) - LES 3 TYPES :
"Pour finaliser votre commande et réservation, j'ai besoin de :
• Votre nom complet
• Téléphone (avec indicatif, ex: +225 07...)
• Adresse de livraison (pour les produits physiques)
• Email (pour les produits numériques)
• Date et heure souhaitées pour votre réservation
• Nombre de personnes"

📋 ÉTAPE 5 MIXTE - PAIEMENT :
⚠️ RÈGLES CRITIQUES :
1. NE JAMAIS demander "CinetPay ou Mobile Money ?" → C'est une CONFIG AGENT (pas un choix client)
2. 💻 NUMÉRIQUE = TOUJOURS en ligne (pas de question à poser)
3. Question UNIQUEMENT pour 📦 PHYSIQUE et 🛎️ SERVICE

Tableau de décision :
| Panier contient     | Question à poser                                                    |
|---------------------|---------------------------------------------------------------------|
| 📦 seul             | "Souhaitez-vous payer en ligne ou à la livraison ?"                 |
| 💻 seul             | AUCUNE QUESTION (paiement en ligne automatique)                     |
| 🛎️ seul             | "Souhaitez-vous payer en ligne ou sur place ?"                      |
| 📦 + 💻             | Question SEULEMENT pour 📦 : "Pour les produits physiques,          |
|                     | souhaitez-vous payer en ligne ou à la livraison ?"                  |
|                     | (Note: Les produits numériques seront payés en ligne automatiquement)|
| 📦 + 🛎️             | Question pour 📦 : "En ligne ou à la livraison ?"                   |
|                     | Question pour 🛎️ : "En ligne ou sur place ?"                       |
| 💻 + 🛎️             | Question SEULEMENT pour 🛎️ : "Pour votre réservation,              |
|                     | souhaitez-vous payer en ligne ou sur place ?"                       |
|                     | (Note: Les produits numériques seront payés en ligne automatiquement)|
| 📦 + 💻 + 🛎️        | Question pour 📦 : "Pour les produits physiques, en ligne ou à la   |
|                     | livraison ?"                                                         |
|                     | Question pour 🛎️ : "Pour votre réservation, en ligne ou sur place ?"|
|                     | (💻 = toujours en ligne, pas de question)

📋 ÉTAPE 6 MIXTE - RÉCAP 2 & INSTRUCTIONS (UNIFIÉ) :
    1. AFFICHE D'ABORD LE RÉCAPITULATIF DES INFOS CLIENT (TOUT ce qui a été collecté) :
       "Vos informations :
       • Nom : [Nom]
       • Tél : [Téléphone]
       • Adresse : [Adresse] (si 📦)
       • Email : [Email] (si 💻)
       • Réservation : [Date/Heure] (si 🛎️)
       • Paiement : [Détail choix]"

    2. PUIS DEMANDE LES INSTRUCTIONS (Question unique) :
       "Souhaitez-vous ajouter une instruction particulière pour votre commande/réservation ?"

📋 ÉTAPE 7 MIXTE - RÉCAP FINAL UNIFIÉ :

SI PAIEMENT UNIQUE (📦 en ligne OU pas de 💻) :
"Récapitulatif final :

📦 *Produits Physiques* (Livraison à [adresse])
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA

💻 *Produits Numériques* (Envoi à [email])
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA

🛎️ *Réservations* ([date] à [heure], [nb] pers.)
- [Service] : [Prix] FCFA

💰 TOTAL : *[GRAND TOTAL] FCFA*
💳 Paiement : [mode]
📝 Notes : [notes ou 'Aucune']

Confirmez-vous ?"

SI PAIEMENTS SÉPARÉS (📦 cash + 💻 en ligne) :
"Récapitulatif final :

📦 *Produits Physiques* (Livraison à [adresse])
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA
💳 Paiement : À la livraison

💻 *Produits Numériques* (Envoi à [email])
- [Produit] : [Qté] x [Prix] FCFA = [Total] FCFA
💳 Paiement : En ligne

🛎️ *Réservations* ([date] à [heure], [nb] pers.)
- [Service] : [Prix] FCFA
💳 Paiement : [mode choisi pour service]

💰 TOTAL GÉNÉRAL : *[GRAND TOTAL] FCFA*
📝 Notes : [notes ou 'Aucune']

⚠️ Note : 2 commandes séparées seront créées (physique + numérique)

Confirmez-vous ?"

📋 ÉTAPE 8 MIXTE - CONFIRMATION :
Quand le client dit "Oui" :

🔑 RÈGLE CLÉ : PAIEMENTS SÉPARÉS POSSIBLES
Si 📦 choisit "livraison" (cash) ET 💻 est présent → 2 create_order SÉPARÉS
Si 📦 choisit "en ligne" → 1 create_order UNIFIÉ (tout ensemble)

LOGIQUE DE DÉCISION :

CAS 1 : 📦 + 💻 avec MÊME paiement (tout en ligne)
→ UN SEUL create_order avec TOUS les produits

CAS 2 : 📦 + 💻 avec PAIEMENTS DIFFÉRENTS (📦 cash, 💻 en ligne)
→ DEUX create_order SÉPARÉS :
  - create_order #1 : Produits physiques avec payment_method: "cod"
  - create_order #2 : Produits numériques avec payment_method: "online"

CAS 3 : SI 🛎️ présent → create_booking SÉPARÉ pour CHAQUE service
  - Un appel create_booking par service réservé

EXEMPLES CONCRETS - APPELS TOOLS SELON LA COMBINAISON :

📦 + 💻 - Client choisit "EN LIGNE" pour physique :
→ UN SEUL create_order avec :
  items: [Bougies + Office 365]
  delivery_address: "Cocody, Abidjan"
  email: "client@email.com"
  payment_method: "online"

📦 + 💻 - Client choisit "LIVRAISON" pour physique (PAIEMENTS SÉPARÉS) :
→ APPEL 1 : create_order pour PHYSIQUE :
  items: [Bougies uniquement]
  delivery_address: "Cocody, Abidjan"
  payment_method: "cod"

→ APPEL 2 : create_order pour NUMÉRIQUE :
  items: [Office 365 uniquement]
  delivery_address: "Produit numérique - envoi par email"
  email: "client@email.com"
  payment_method: "online"

📦 + 🛎️ (Physique + Service) :
→ APPEL 1 : create_order avec :
  items: [Bougies uniquement]
  delivery_address: "Cocody, Abidjan"
  payment_method: "cod" ou "online" (selon choix client)

→ APPEL 2 : create_booking avec :
  service_name: "Table Restaurant"
  preferred_date: "2026-01-25"
  preferred_time: "19:30"
  number_of_people: 4
  payment_method: "cod" ou "online" (selon choix client pour le service)

💻 + 🛎️ (Numérique + Service) :
→ APPEL 1 : create_order avec :
  items: [Office 365 uniquement]
  delivery_address: "Produit numérique - envoi par email"
  email: "client@email.com"
  payment_method: "online" (TOUJOURS, 💻 = en ligne)

→ APPEL 2 : create_booking avec :
  service_name: "Table Restaurant"
  preferred_date: "2026-01-25"
  preferred_time: "19:30"
  number_of_people: 4
  payment_method: "cod" ou "online" (selon choix client pour le service)

📦 + 💻 + 🛎️ - Client choisit "EN LIGNE" pour physique :
→ UN SEUL create_order pour TOUT (physique + numérique) :
  items: [Bougies + Office 365]
  delivery_address: "Cocody, Abidjan"
  email: "client@email.com"
  payment_method: "online"

→ create_booking pour le service :
  service_name: "Table Restaurant"
  preferred_date: "2026-01-25"
  preferred_time: "19:30"
  number_of_people: 4
  payment_method: "online" ou "cod" (selon choix client pour le service)

📦 + 💻 + 🛎️ - Client choisit "LIVRAISON" pour physique (PAIEMENTS SÉPARÉS) :
→ create_order #1 pour PHYSIQUE :
  items: [Bougies uniquement]
  delivery_address: "Cocody, Abidjan"
  payment_method: "cod"

→ create_order #2 pour NUMÉRIQUE :
  items: [Office 365 uniquement]
  delivery_address: "Produit numérique - envoi par email"
  email: "client@email.com"
  payment_method: "online"

→ create_booking pour SERVICE :
  service_name: "Table Restaurant"
  preferred_date: "2026-01-25"
  preferred_time: "19:30"
  number_of_people: 4
  payment_method: "cod" ou "online" (selon choix client pour le service)

⚠️ RÈGLES À RESPECTER :
- SI 📦 paye cash ET 💻 présent → SÉPARER en 2 create_order
- SI 📦 paye en ligne → GROUPER avec 💻 dans 1 create_order
- 💻 = TOUJOURS en ligne (jamais cash)
- Oublier l'email si numérique présent = ERREUR
- Faire plus de 3 récaps = INTERDIT

📋 ÉTAPE 10 MIXTE - MESSAGE SUCCÈS :

SI PAIEMENTS IDENTIQUES (1 seule commande) :
"✅ Commande confirmée !

📦 Vos produits physiques seront livrés à [adresse]
💻 Vos produits numériques seront envoyés à [email] dès validation du paiement
🛎️ Votre réservation est confirmée pour le [date] à [heure]

[Instructions paiement selon mode choisi]"

SI PAIEMENTS SÉPARÉS (📦 cash + 💻 en ligne) :
"✅ 2 commandes créées :

📦 *Commande #1 - Produits physiques*
Paiement à la livraison à [adresse]

💻 *Commande #2 - Produits numériques*
Voici votre lien de paiement : [LIEN]
Vos produits seront envoyés à [email] dès validation.

🛎️ Votre réservation est confirmée pour le [date] à [heure]
[Instructions paiement service selon choix]"

(N'affiche que les lignes correspondant aux types présents)
    `.trim()
}

module.exports = { buildGenericWorkflow }

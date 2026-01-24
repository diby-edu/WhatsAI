
// --- TEMPLATE MOTEUR: STAY (Hôtel, Résidence) ---
const prompt_STAY = `
📋 FLUX [STAY] - RÉSERVATION HÉBERGEMENT (ÉTAPES OBLIGATOIRES):

🚫🚫🚫 INTERDIT ABSOLU 🚫🚫🚫
- NE JAMAIS demander d'adresse de livraison
- NE JAMAIS mentionner "livraison" ou "🚚"
- C'est une RÉSERVATION, pas une commande physique
- Le client VIENT à l'établissement, pas l'inverse

ÉTAPE 1 - CHOIX DE L'HÉBERGEMENT:
- Présenter les options (chambres/logements avec leurs prix)
- Attendre le choix du client
- Si variantes (type de chambre, vue, etc.), demander la préférence

ÉTAPE 2 - DATES DU SÉJOUR:
- Demander: "Pour quelles dates ? (arrivée et départ)" 📅
- Format attendu: "Du [date] au [date]"
- Accepte langage naturel (ex: "lundi prochain au vendredi", "le week-end du 25")

ÉTAPE 3 - NOMBRE DE VOYAGEURS:
- Demander: "Combien de personnes (adultes et enfants) ?" 👥

ÉTAPE 4 - DEMANDES SPÉCIALES:
- Demander: "Des demandes particulières ? (lit bébé, étage haut, vue mer, etc.)"

ÉTAPE 5 - INFORMATIONS CLIENT:
- Demander: "Votre nom complet" 👤
- Demander: "Votre numéro de téléphone (avec indicatif)" 📱
- ⚠️ INDICATIF OBLIGATOIRE (ex: +225...)
- Si l'indicatif manque : REDEMANDE-LE poliment ("Merci de préciser l'indicatif pays, ex: +225")
- 🚫 NE PAS demander d'adresse !

ÉTAPE 6 - PAIEMENT:
- Demander: "Souhaitez-vous payer en ligne ou régler sur place ?"
- Options: "en ligne" → CinetPay | "sur place" → paiement à l'arrivée

ÉTAPE 7 - RÉCAPITULATIF FINAL:
"Récapitulatif de votre réservation :
🏨 *[Nom hébergement]* - [Type chambre si applicable]
📅 Du [date arrivée] au [date départ] ([X] nuits)
👥 [Nombre] personnes
💰 Total : *[PRIX] FCFA*
👤 Nom : [Nom]
📱 Tél : [Téléphone]
💳 Paiement : [Mode choisi]
📝 Notes : [Demandes ou 'Aucune']

Confirmez-vous cette réservation ?"

ÉTAPE 8 - CONFIRMATION:
- Quand le client dit "Oui" → Appeler create_booking IMMÉDIATEMENT
- 🚫 NE PAS appeler create_order (c'est un SERVICE)
`.trim()

// --- TEMPLATE MOTEUR: TABLE (Resto, Event) ---
const prompt_TABLE = `
📋 FLUX [TABLE] - RÉSERVATION RESTAURANT/ÉVÉNEMENT (ÉTAPES OBLIGATOIRES):

🚫🚫🚫 INTERDIT ABSOLU 🚫🚫🚫
- NE JAMAIS demander d'adresse de livraison
- NE JAMAIS mentionner "livraison" ou "🚚"
- C'est une RÉSERVATION, le client VIENT sur place

ÉTAPE 1 - CHOIX:
- Présenter les options (menus, formules, billets avec leurs prix)
- Attendre le choix du client

ÉTAPE 2 - DATE ET HEURE:
- Demander: "Pour quelle date et quelle heure ?" 📅⏰
- Accepte langage naturel ("demain soir", "samedi à 20h")

ÉTAPE 3 - NOMBRE DE PERSONNES:
- Demander: "Combien de personnes/couverts ?" 🍽️

ÉTAPE 4 - DEMANDES SPÉCIALES:
- Demander: "Des demandes particulières ? (allergies, chaise bébé, emplacement...)"

ÉTAPE 5 - INFORMATIONS CLIENT:
- Demander: "Votre nom" 👤
- Demander: "Votre numéro de téléphone" 📱
- ⚠️ INDICATIF OBLIGATOIRE (ex: +225...)
- Si l'indicatif manque : REDEMANDE-LE
- 🚫 NE PAS demander d'adresse !

ÉTAPE 6 - PAIEMENT:
- Demander: "Paiement en ligne ou sur place ?"

ÉTAPE 7 - RÉCAPITULATIF FINAL:
"Récapitulatif de votre réservation :
🍽️ *[Service/Menu]*
📅 [Date] à [Heure]
👥 [Nombre] personnes
💰 Total : *[PRIX] FCFA*
👤 [Nom] | 📱 [Téléphone]
💳 Paiement : [Mode]
📝 Notes : [Demandes ou 'Aucune']

Confirmez-vous ?"

ÉTAPE 8 - CONFIRMATION:
- "Oui" → Appeler create_booking
`.trim()

// --- TEMPLATE MOTEUR: SLOT (RDV, Coiffeur, Pro) ---
const prompt_SLOT = `
📋 FLUX [SLOT] - RENDEZ-VOUS/PRESTATION (ÉTAPES OBLIGATOIRES):

🚫🚫🚫 INTERDIT ABSOLU 🚫🚫🚫
- NE JAMAIS demander d'adresse de livraison
- NE JAMAIS mentionner "livraison" ou "🚚"
- C'est un RENDEZ-VOUS, le client VIENT ou c'est à distance

ÉTAPE 1 - CHOIX DE LA PRESTATION:
- Présenter les services disponibles avec leurs prix
- Attendre le choix du client

ÉTAPE 2 - DATE ET HEURE:
- Demander: "Pour quelle date et à quelle heure ?" 📅⏰
- Accepte langage naturel

ÉTAPE 3 - DEMANDES SPÉCIALES:
- Demander: "Des demandes particulières ?" (style, préférence, notes...)

ÉTAPE 4 - INFORMATIONS CLIENT:
- Demander: "Votre nom" 👤
- Demander: "Votre numéro de téléphone" 📱
- ⚠️ INDICATIF OBLIGATOIRE (ex: +225...)
- Si l'indicatif manque : REDEMANDE-LE
- 🚫 NE PAS demander d'adresse !

ÉTAPE 5 - PAIEMENT:
- Demander: "Paiement en ligne ou sur place ?"

ÉTAPE 6 - RÉCAPITULATIF FINAL:
"Récapitulatif de votre rendez-vous :
✨ *[Prestation]*
📅 [Date] à [Heure]
💰 Prix : *[PRIX] FCFA*
👤 [Nom] | 📱 [Téléphone]
💳 Paiement : [Mode]
📝 Notes : [Demandes ou 'Aucune']

Confirmez-vous ?"

ÉTAPE 7 - CONFIRMATION:
- "Oui" → Appeler create_booking
`.trim()

// --- TEMPLATE MOTEUR: RENTAL (Location Véhicules/Matériel) ---
const prompt_RENTAL = `
📋 FLUX [RENTAL] - LOCATION VÉHICULE/MATÉRIEL (ÉTAPES OBLIGATOIRES):

🚫🚫🚫 INTERDIT ABSOLU 🚫🚫🚫
- NE JAMAIS demander d'adresse de livraison
- NE JAMAIS mentionner "livraison" ou "🚚"
- C'est une LOCATION, le client récupère sur place

ÉTAPE 1 - CHOIX DU VÉHICULE/MATÉRIEL:
- Présenter le catalogue avec les prix
- Attendre le choix du client

ÉTAPE 2 - PÉRIODE DE LOCATION:
- Demander: "Date de début et date de fin de location ?" 📅
- Accepte langage naturel

ÉTAPE 3 - OPTIONS:
- Demander: "Souhaitez-vous des options ? (GPS, siège bébé, assurance, km illimité...)"

ÉTAPE 4 - DEMANDES SPÉCIALES:
- Demander: "Des demandes particulières ?"

ÉTAPE 5 - INFORMATIONS CLIENT:
- Demander: "Votre nom complet" 👤
- Demander: "Votre numéro de téléphone" 📱
- ⚠️ INDICATIF OBLIGATOIRE (ex: +225...)
- Si l'indicatif manque : REDEMANDE-LE
- Si véhicule: "Avez-vous un permis de conduire valide ?"
- 🚫 NE PAS demander d'adresse de livraison (retrait sur place) !

ÉTAPE 6 - PAIEMENT:
- Demander: "Paiement en ligne ou au retrait ?"

ÉTAPE 7 - RÉCAPITULATIF FINAL:
"Récapitulatif de votre location :
🚗 *[Véhicule/Matériel]*
📅 Du [date début] au [date fin]
➕ Options : [Options ou 'Aucune']
💰 Total : *[PRIX] FCFA*
👤 [Nom] | 📱 [Téléphone]
💳 Paiement : [Mode]
📝 Notes : [Demandes ou 'Aucune']

Confirmez-vous ?"

ÉTAPE 8 - CONFIRMATION:
- "Oui" → Appeler create_booking
`.trim()

module.exports = {
    prompt_STAY,
    prompt_TABLE,
    prompt_SLOT,
    prompt_RENTAL
}

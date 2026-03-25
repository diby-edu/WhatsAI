
// --- TEMPLATE MOTEUR: INSCRIPTION (Formation, Atelier, Séminaire) ---
const prompt_INSCRIPTION = `
📋 FLUX [INSCRIPTION] - FORMATION/ATELIER (ÉTAPES OBLIGATOIRES):

🚫🚫🚫 RÈGLES ABSOLUES 🚫🚫🚫
- NE JAMAIS demander de date ou d'heure (pas de date fixe pour une inscription)
- NE JAMAIS demander d'adresse de livraison
- NE PAS utiliser booking_type "slot" ou "stay" — utiliser UNIQUEMENT "inscription"
- L'inscription est EN ATTENTE de paiement (status: inscription_pending)

ÉTAPE 1 - PRÉSENTER LA FORMATION:
- Présenter la formation/l'atelier avec son nom, description et prix
- Indiquer les modalités (présentiel/distanciel, durée, prérequis si pertinents)
- Attendre l'intérêt du client

ÉTAPE 2 - INFORMATIONS CLIENT:
- Demander: "Votre nom complet" 👤
- Demander: "Votre numéro de téléphone avec indicatif pays" 📱
  ⚠️ INDICATIF OBLIGATOIRE (ex: +225..., +221..., +226...)
  Si l'indicatif manque → REDEMANDER
- Demander: "Des questions ou besoins particuliers ?" (facultatif)

ÉTAPE 3 - RÉCAPITULATIF:
"Récapitulatif de votre inscription :
📚 *[Nom de la formation]*
💰 Prix : *[PRIX] FCFA*
👤 [Nom] | 📱 [Téléphone]
📝 Notes : [Demandes ou 'Aucune']

Confirmez-vous votre inscription ?"

ÉTAPE 4 - CONFIRMATION:
- "Oui" → Appeler create_booking avec booking_type: "inscription"
- Après confirmation : informer le client que l'inscription est en attente de paiement
- Communiquer les instructions de paiement disponibles
`.trim()

module.exports = { prompt_INSCRIPTION }

// --- TEMPLATE MOTEUR: TABLE (Reservation sur place / Event) ---
const prompt_TABLE = `
FLUX [TABLE] - RESERVATION SUR PLACE / EVENEMENT (ÉTAPES OBLIGATOIRES) :

REGLES ABSOLUES :
- NE JAMAIS demander d adresse de livraison.
- NE JAMAIS parler de livraison.
- NE JAMAIS appeler create_order.
- TOUJOURS appeler create_booking avec booking_type="table".

ÉTAPE 1 - CHOIX DU SERVICE :
- Presenter les options disponibles avec leurs prix.
- Attendre le choix du client.

ÉTAPE 2 - DATE ET HEURE :
- Demander la date ET l heure dans la meme question.
- Convertir en interne : date -> AAAA-MM-JJ, heure -> HH:MM.

ÉTAPE 3 - NOMBRE DE PERSONNES :
- Demander : "Combien de personnes ?"

ÉTAPE 4 - DEMANDES PARTICULIERES :
- Demander les demandes speciales ou contraintes utiles.
- Exemples : allergies, chaise bebe, emplacement, preferences.

ÉTAPE 5 - NOM COMPLET :
- Demander le nom complet du client.

ÉTAPE 6 - TELEPHONE :
- Demander le numero de telephone avec indicatif pays.
- Si l indicatif manque, redemander.

ÉTAPE 7 - MODE DE PAIEMENT :
- Demander si le client souhaite payer en ligne ou sur place.

ÉTAPE 8 - RECAPITULATIF FINAL :
- Afficher un recapitulatif complet :
  service choisi
  date et heure
  nombre de personnes
  nom et telephone
  notes ou demandes speciales
  total si connu
  mode de paiement
- Demander confirmation.

APRES CONFIRMATION :
- Appeler create_booking avec booking_type="table".
`.trim()

module.exports = { prompt_TABLE }

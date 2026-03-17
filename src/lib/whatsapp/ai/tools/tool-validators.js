/**
 * ═══════════════════════════════════════════════════════════════
 * TOOL VALIDATORS
 * ═══════════════════════════════════════════════════════════════
 *
 * Validation permissive des payloads IA AVANT l'exécution de chaque tool.
 * Règle : bloquer uniquement les cas CLAIREMENT invalides (champ obligatoire
 * absent, type manifestement faux) pour éviter crashes et inserts corrompus.
 *
 * Retour : null si valide, chaîne JSON d'erreur sinon (format uniforme tools).
 */

/**
 * Valide les arguments de create_order.
 *
 * Cas bloqués :
 * - items absent ou tableau vide → crash TypeError sur .some()/.forEach()
 * - item sans product_name ou quantity ≤ 0
 *
 * @param {Object} args - Arguments bruts passés par l'IA
 * @returns {string|null} JSON erreur ou null si valide
 */
function validateCreateOrderArgs(args) {
    const { items, customer_name, customer_phone } = args

    if (!Array.isArray(items) || items.length === 0) {
        return JSON.stringify({
            success: false,
            error: 'ARTICLES MANQUANTS. La commande doit contenir au moins un article. Demandez au client quels produits il souhaite commander.',
            hint: 'Exemple : "Quels articles souhaitez-vous commander et en quelle quantité ?"'
        })
    }

    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'NOM MANQUANT. Demandez d abord le nom complet du client avant de creer la commande.',
            hint: 'Demande : "Quel est votre nom complet ?"'
        })
    }

    if (!customer_phone || typeof customer_phone !== 'string' || customer_phone.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'TELEPHONE MANQUANT. Demandez le numero complet avec indicatif pays avant de creer la commande.',
            hint: 'Demande : "Quel est votre numero WhatsApp avec indicatif pays ?"'
        })
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i]

        if (!item.product_name || typeof item.product_name !== 'string' || item.product_name.trim() === '') {
            return JSON.stringify({
                success: false,
                error: `Article #${i + 1} : nom du produit manquant ou invalide. Vérifiez les articles de la commande.`
            })
        }

        const qty = Number(item.quantity)
        if (!item.quantity || isNaN(qty) || qty <= 0) {
            return JSON.stringify({
                success: false,
                error: `Article "${item.product_name}" : quantité invalide (${item.quantity}). La quantité doit être un nombre positif.`,
                hint: 'Demandez : "Quelle quantité souhaitez-vous ?"'
            })
        }
    }

    return null
}

/**
 * Valide les arguments de create_booking.
 *
 * Cas bloqués :
 * - service_name absent → crash TypeError sur .toLowerCase() ligne 33
 *
 * @param {Object} args - Arguments bruts passés par l'IA
 * @returns {string|null} JSON erreur ou null si valide
 */
function validateCreateBookingArgs(args) {
    const { service_name, customer_name, customer_phone, preferred_date } = args

    if (!service_name || typeof service_name !== 'string' || service_name.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'SERVICE MANQUANT. Le nom du service est obligatoire pour créer une réservation. Demandez au client quel service il souhaite réserver.',
            hint: 'Exemple : "Quel service souhaitez-vous réserver ?"'
        })
    }

    if (!customer_name || typeof customer_name !== 'string' || customer_name.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'NOM MANQUANT. Demandez le nom complet du client avant de creer la reservation.',
            hint: 'Demande : "Quel est votre nom complet ?"'
        })
    }

    if (!customer_phone || typeof customer_phone !== 'string' || customer_phone.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'TELEPHONE MANQUANT. Demandez le numero complet avec indicatif pays avant de creer la reservation.',
            hint: 'Demande : "Quel est votre numero de telephone avec indicatif pays ?"'
        })
    }

    if (!preferred_date || typeof preferred_date !== 'string' || preferred_date.trim() === '') {
        return JSON.stringify({
            success: false,
            error: 'DATE MANQUANTE. Demandez la date souhaitee avant de creer la reservation.',
            hint: 'Demande : "Pour quelle date souhaitez-vous reserver ?"'
        })
    }

    return null
}

module.exports = { validateCreateOrderArgs, validateCreateBookingArgs }

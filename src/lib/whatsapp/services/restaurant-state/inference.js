'use strict'

const { RESTAURANT_STAGE, normalizeText, cloneRestaurantState } = require('./persistence')

function inferRestaurantStateFromAssistantMessage(content, previousState = {}) {
    const state = cloneRestaurantState(previousState)
    const n = normalizeText(content)
    if (!n) return state

    // Acompte requis → passer en DEPOSIT (attente paiement)
    if (/acompte|lien de paiement|pour confirmer.*versez|sera confirmee des reception|paiement.*requis|deposez/.test(n)) {
        state.stage = RESTAURANT_STAGE.DEPOSIT
        return state
    }

    // Confirmation sans acompte → réinitialiser l'état
    if (/(reservation|commande).*(confirmee|confirmee|enregistree|validee)/.test(n) && !/acompte/.test(n)) {
        return cloneRestaurantState({})
    }
    if (/reservation restaurant enregistree|commande restaurant enregistree|reservation de table enregistree|checkout confirme/.test(n)) {
        return cloneRestaurantState({})
    }

    return state
}

module.exports = {
    inferRestaurantStateFromAssistantMessage,
}

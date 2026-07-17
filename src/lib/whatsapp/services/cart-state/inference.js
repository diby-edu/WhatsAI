const { CART_STAGE, cloneCartState } = require('./persistence')
const { normalizeText, findBestProduct, createDraftItem, buildAwaitingField } = require('./stage')

function inferCartStateFromAssistantMessage(content, previousState, products = [], currency = 'XOF') {
    const text = normalizeText(content)
    const state = cloneCartState(previousState)
    const hasCartLines = Array.isArray(state.cart_items) && state.cart_items.length > 0
    const isStructuredCheckoutReply = hasCartLines &&
        state.stage === CART_STAGE.CHECKOUT &&
        /vos informations|1\.\s*continuer|2\.\s*modifier une information|recapitulatif\s*:|1\.\s*confirmer ma commande|2\.\s*modifier mes informations|3\.\s*modifier le panier|- produit\s*:|- total\s*:/i.test(text)

    if (!text) return state

    if (/commande confirmee|commande creee|lien de paiement securise|lien de paiement|commande valid[ée]e/i.test(text)) {
        return cloneCartState({})
    }

    if (isStructuredCheckoutReply) {
        state.stage = CART_STAGE.CHECKOUT
        state.awaiting_field = null
        state.last_prompt_kind = CART_STAGE.CHECKOUT
        state.last_prompt_text = content
        return state
    }

    if (hasCartLines && /nom complet|numero de telephone|adresse de livraison|telephone \(avec indicatif\)|adresse email/i.test(text)) {
        state.stage = CART_STAGE.CHECKOUT
        state.awaiting_field = null
        state.last_prompt_kind = CART_STAGE.CHECKOUT
        state.last_prompt_text = content
        return state
    }

    if (state.stage === CART_STAGE.CART_RECAP) {
        return state
    }

    // Ne pas inférer si le message mentionne plusieurs produits (catalogue)
    const matchingProductsCount = (products || []).filter(p => {
        const productName = normalizeText(p.name)
        if (!productName) return false
        if (text === productName) return true
        if (text.includes(productName) || productName.includes(text)) return true
        const terms = text.split(' ').filter(t => t.length > 2)
        return terms.filter(t => productName.includes(t)).length * 15 >= 30
    }).length

    const detectedProduct = matchingProductsCount === 1 ? findBestProduct(products, text) : null
    if (detectedProduct && !state.draft_item) {
        state.draft_item = createDraftItem(detectedProduct)
        state.stage = CART_STAGE.COLLECTING_ITEM
        state.awaiting_field = buildAwaitingField(detectedProduct, state.draft_item, currency)
        state.last_prompt_kind = CART_STAGE.COLLECTING_ITEM
        state.last_prompt_text = content
    }

    return state
}

module.exports = {
    inferCartStateFromAssistantMessage,
}

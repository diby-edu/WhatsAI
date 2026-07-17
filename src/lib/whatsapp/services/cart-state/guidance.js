const { CART_STAGE, cloneCartState } = require('./persistence')
const { formatLineLabel, findProductById, getOptionalVariants, getSelectedVariantValue, buildCartActionField } = require('./stage')

function buildCartStateGuidance(cartState, products = [], options = {}) {
    const state = cloneCartState(cartState)

    if ((!state.cart_items || state.cart_items.length === 0) && !state.draft_item) return ''

    const lines = ['PANIER STRUCTURE (source systeme, prioritaire):']

    if (state.cart_items.length > 0) {
        lines.push(`- Lignes deja validees: ${state.cart_items.length}`)
        let cartTotal = 0
        state.cart_items.forEach((item, index) => {
            lines.push(`- Ligne ${index + 1}: ${formatLineLabel(item)}`)
            cartTotal += Number(item.line_total) || ((Number(item.unit_price) || 0) * (item.quantity || 0))
        })
        if (cartTotal > 0) {
            lines.push(`- Total panier: ${cartTotal.toLocaleString('fr-FR')} FCFA`)
            lines.push('- Utiliser ce total exact dans tout recapitulatif. Ne jamais ecrire [insérer le montant].')
        }
    }

    if (state.draft_item) {
        const product = findProductById(products, state.draft_item.product_id)
        lines.push(`- Ligne en cours: ${state.draft_item.product_name}`)

        if (state.draft_item.quantity) {
            lines.push(`- Quantite deja validee: ${state.draft_item.quantity}`)
        } else {
            lines.push('- Quantite encore manquante')
        }

        const selectedVariants = Object.entries(state.draft_item.selected_variants || {})
        if (selectedVariants.length > 0) {
            lines.push(`- Variantes deja collectees: ${selectedVariants.map(([label, value]) => `${label}=${value}`).join(', ')}`)
        }

        const optionalVariants = product
            ? getOptionalVariants(product)
                .filter(variant => getSelectedVariantValue(state.draft_item, variant.id))
                .map(variant => `${variant.label}=${getSelectedVariantValue(state.draft_item, variant.id)}`)
            : []

        if (optionalVariants.length > 0) {
            lines.push(`- Options/supplements deja collectes: ${optionalVariants.join(', ')}`)
        }
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    lines.push('- Si le client donne une information hors ordre (ex: couleur avant quantite), memorise-la mais redemande le champ bloquant.')
    lines.push('- Interdiction de supposer une quantite par defaut, sauf pour un produit numerique simple livre en document/lien : dans ce cas la quantite reste forcee a 1.')

    if (state.stage === CART_STAGE.CART_RECAP) {
        lines.push('- Le panier contient deja une ou plusieurs lignes validees. Demande seulement si le client veut ajouter un autre article.')
    }

    if (state.stage === CART_STAGE.CHECKOUT) {
        lines.push('- Le panier produit est deja verrouille. Ne redemande ni quantite ni variantes. Passe uniquement aux informations client.')
    }

    if (options.questionDetected) {
        const contactRef = options.escalationPhone ? `au *${options.escalationPhone}*` : 'directement au service client'
        lines.push('---')
        lines.push('QUESTION HORS-PARCOURS DETECTEE :')
        lines.push('1. Si la reponse est dans la base de connaissance, reponds d abord a la question.')
        lines.push(`2. Si l information est absente, dis honnetement que tu ne l as pas et oriente vers ${contactRef}.`)
        lines.push('3. Ensuite, reviens naturellement au tunnel de commande la ou il etait.')
        if (state.awaiting_field?.label) {
            lines.push(`4. Rappelle le champ encore attendu : ${state.awaiting_field.label}.`)
        }
        lines.push('Ne saute pas la question. Ne redemarre pas le panier.')
    }

    return lines.join('\n')
}

function mergeCartStateIntoToolArgs(functionName, args = {}, cartState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCartState(cartState)

    const cartItems = (state.cart_items || [])
        .filter(item => item?.product_name && item?.quantity)
        .map(item => ({
            product_name: item.product_name,
            quantity: item.quantity,
            selected_variants: { ...(item.selected_variants || {}) },
        }))

    if (cartItems.length > 0) {
        return {
            ...args,
            items: cartItems,
        }
    }

    const draftItem = state.draft_item
    if (!draftItem || !draftItem.product_name || !draftItem.quantity) return args

    const structuredItem = {
        product_name: draftItem.product_name,
        quantity: draftItem.quantity,
        selected_variants: { ...(draftItem.selected_variants || {}) },
    }

    if (!Array.isArray(args.items) || args.items.length === 0) {
        return {
            ...args,
            items: [structuredItem]
        }
    }

    if (args.items.length === 1) {
        const existingItem = args.items[0] || {}
        return {
            ...args,
            items: [{
                ...existingItem,
                product_name: existingItem.product_name || structuredItem.product_name,
                quantity: existingItem.quantity || structuredItem.quantity,
                selected_variants: {
                    ...structuredItem.selected_variants,
                    ...(existingItem.selected_variants || {})
                }
            }]
        }
    }

    return args
}

function resetCartToRecap(state, currency = 'XOF') {
    const newState = {
        ...state,
        stage: CART_STAGE.CART_RECAP,
        awaiting_field: buildCartActionField(),
        last_prompt_kind: CART_STAGE.CART_RECAP,
        draft_item: null,
    }
    const lines = ['Votre panier actuel :']
    let total = 0
    for (const item of newState.cart_items || []) {
        const lineTotal = Number(item.line_total) || 0
        total += lineTotal
        lines.push(`· ${item.product_name} x ${item.quantity} = ${lineTotal.toLocaleString('fr-FR')} ${currency}`)
    }
    lines.push(`\n💰 Total : ${total.toLocaleString('fr-FR')} ${currency}`)
    lines.push('\nQue souhaitez-vous modifier ?')
    lines.push('(quantité ex: "3 adobe" · supprimer ex: "supprimer window" · ajouter ex: "ajouter office" · ou tapez "ok" pour confirmer)')
    return {
        state: newState,
        directReply: lines.join('\n'),
    }
}

module.exports = {
    buildCartStateGuidance,
    mergeCartStateIntoToolArgs,
    resetCartToRecap,
}

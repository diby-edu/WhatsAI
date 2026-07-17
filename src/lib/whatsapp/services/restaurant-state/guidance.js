'use strict'

const { RESTAURANT_STAGE, cloneRestaurantState, hasRestaurantStateData } = require('./persistence')

function buildRestaurantStateGuidance(restaurantState = {}, options = {}) {
    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return ''

    const lines = ['RESTAURANT STATE (source système, prioritaire) :']
    lines.push(`- Stage : ${state.stage}`)

    if (state.cart_items.length > 0) {
        lines.push(`- Panier : ${state.cart_items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')}`)
        const total = state.cart_items.reduce((s, i) => s + i.line_total_fcfa, 0)
        lines.push(`- Total panier : ${total.toLocaleString('fr-FR')} FCFA`)
    }

    const cf = state.customer_flow
    if (state.fulfillment_mode) lines.push(`- Mode : ${state.fulfillment_mode}`)
    if (cf.scheduled_date) lines.push(`- Date : ${cf.scheduled_date}${cf.scheduled_time ? ' à ' + cf.scheduled_time : ''}`)
    if (cf.party_size)     lines.push(`- Personnes : ${cf.party_size}`)
    if (cf.delivery_address) lines.push(`- Adresse livraison : ${cf.delivery_address}`)
    if (cf.customer_name)  lines.push(`- Nom : ${cf.customer_name}`)
    if (cf.customer_phone) lines.push(`- Téléphone : ${cf.customer_phone}`)
    if (cf.note_declined)  lines.push('- Notes : aucune (déclinées)')
    else if (cf.notes)     lines.push(`- Notes : ${cf.notes}`)

    if (state.awaiting_cf_field?.label) {
        lines.push(`- Champ en attente : ${state.awaiting_cf_field.label}`)
    }

    if (state.stage === RESTAURANT_STAGE.READY) {
        lines.push('- Le client vient de confirmer.')
        lines.push('- Appelle create_restaurant_checkout maintenant avec les données ci-dessus.')
        lines.push('- Ne pose pas de question avant l\'appel.')
    } else if (state.stage === RESTAURANT_STAGE.DEPOSIT) {
        lines.push('- STATUT : En attente de paiement d\'acompte.')
        lines.push('- Ne relance PAS le parcours de commande.')
        lines.push('- Ne recrée PAS de checkout.')
        lines.push('- Si le client dit avoir payé → réponds : "Parfait ! Votre réservation sera confirmée automatiquement dès réception du paiement."')
        lines.push('- Si le client pose une autre question → réponds-y, puis rappelle l\'attente d\'acompte.')
    } else {
        lines.push('- Ne redemande jamais les infos déjà collectées.')
    }

    if (options.questionDetected) {
        const contactRef = options.escalationPhone ? `au *${options.escalationPhone}*` : 'directement au restaurant'
        lines.push('---')
        lines.push('⚠️ QUESTION HORS-PARCOURS DÉTECTÉE :')
        lines.push('  1. Si la réponse est dans la base de connaissance → réponds précisément.')
        lines.push(`  2. Si l\'info est absente → dis : "Je n\'ai pas cette information. Contactez-nous ${contactRef}."`)
        lines.push('  3. Dans tous les cas, rappelle naturellement où on en était.')
        if (state.awaiting_cf_field?.label) {
            lines.push(`     Ex : "Pour votre commande, il me reste à confirmer : ${state.awaiting_cf_field.label}."`)
        }
        lines.push('  NE PAS inventer. NE PAS sauter au champ manquant sans répondre.')
    }

    return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════
// MERGE TOOL ARGS
// ═══════════════════════════════════════════════════════════════

function mergeRestaurantStateIntoToolArgs(functionName, args = {}, restaurantState = {}) {
    if (functionName !== 'create_restaurant_checkout') return args
    const state = cloneRestaurantState(restaurantState)
    if (!hasRestaurantStateData(state)) return args

    const cf = state.customer_flow
    const mergedItems = Array.isArray(args.items) && args.items.length > 0
        ? args.items
        : state.cart_items.map(item => ({ product_name: item.product_name, quantity: item.quantity }))

    return {
        ...args,
        fulfillment_mode:  state.fulfillment_mode || args.fulfillment_mode,
        items:             state.cart_items.length > 0 ? state.cart_items.map(item => ({ product_name: item.product_name, quantity: item.quantity })) : mergedItems,
        customer_name:     cf.customer_name    || args.customer_name,
        customer_phone:    cf.customer_phone   || args.customer_phone,
        scheduled_date:    cf.scheduled_date   || args.scheduled_date,
        scheduled_time:    cf.scheduled_time   || args.scheduled_time,
        party_size:        cf.party_size       || args.party_size,
        delivery_address:  cf.delivery_address || args.delivery_address,
        payment_method:    args.payment_method    || cf.payment_method,
        notes:             args.notes !== undefined ? args.notes : cf.notes,
    }
}

module.exports = {
    buildRestaurantStateGuidance,
    mergeRestaurantStateIntoToolArgs,
}

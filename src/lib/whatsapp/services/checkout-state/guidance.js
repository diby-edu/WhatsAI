const { cloneCheckoutState } = require('./persistence')
const { normalizeFreeText } = require('./parsing')
const { hasCheckoutData } = require('./stage')
const { updateCheckoutStateFromUserMessage } = require('./update')

function buildCheckoutStateGuidance(checkoutState, options = {}) {
    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}
    const lines = []

    if (!hasCheckoutData(state)) {
        return ''
    }

    lines.push('CHECKOUT STATE (source systeme, prioritaire):')

    if (state.stage) {
        lines.push(`- Etape courante: ${state.stage}`)
    }

    if (collected.customer_name) lines.push(`- Nom deja collecte: ${collected.customer_name}`)
    if (collected.customer_phone) lines.push(`- Telephone deja collecte: ${collected.customer_phone}`)
    if (collected.email) lines.push(`- Email deja collecte: ${collected.email}`)
    if (collected.delivery_address) lines.push(`- Adresse deja collectee: ${collected.delivery_address}`)

    if (collected.payment_method) {
        lines.push(`- Paiement deja choisi: ${collected.payment_method === 'cod' ? 'a la livraison' : 'en ligne'}`)
        lines.push('- Interdiction de redemander le mode de paiement.')
    }

    if (state.note_declined) {
        lines.push('- Le client a refuse d ajouter une instruction particuliere.')
        lines.push('- Passe directement au recapitulatif final et a la confirmation.')
    } else if (state.collected.notes) {
        lines.push(`- Note deja fournie: ${state.collected.notes}`)
    }

    if (state.awaiting_field?.label) {
        lines.push(`- Champ bloquant actuel: ${state.awaiting_field.label}`)
    }

    if (state.pending_fields.length > 0) {
        const labels = {
            customer_name: 'nom complet',
            customer_phone: 'numero de telephone avec indicatif',
            email: 'adresse email',
            delivery_address: 'adresse de livraison',
            payment_method: 'mode de paiement',
            notes: 'instruction particuliere',
        }
        lines.push(`- Demande uniquement les champs encore manquants: ${state.pending_fields.map(field => labels[field] || field).join(', ')}`)
    }

    if (options.questionDetected) {
        const contactRef = options.escalationPhone ? `au *${options.escalationPhone}*` : 'directement au service client'
        lines.push('---')
        lines.push('QUESTION HORS-PARCOURS DETECTEE :')
        lines.push('1. Si la reponse est dans la base de connaissance, reponds d abord a la question du client.')
        lines.push(`2. Si l information manque, dis honnetement que tu ne l as pas et oriente vers ${contactRef}.`)
        lines.push('3. Ensuite, reviens naturellement au checkout en rappelant ce qu il reste a confirmer.')
        if (state.awaiting_field?.label) {
            lines.push(`4. Champ a reprendre ensuite : ${state.awaiting_field.label}.`)
        }
        lines.push('Ne saute pas la question. Ne relance pas create_order tant que le client n a pas reconfirme.')
    }

    return lines.join('\n')
}

function inferCheckoutStateFromAssistantMessage(content, previousState = {}) {
    const text = normalizeFreeText(content)
    const state = cloneCheckoutState(previousState)

    if (!text) return state

    if (/commande confirmee|commande creee|lien de paiement securise|lien de paiement/i.test(text)) {
        return cloneCheckoutState({})
    }

    return state
}

function applyUserReplyToCheckoutState(checkoutState, text) {
    return updateCheckoutStateFromUserMessage(checkoutState, text, {}).state
}

function mergeCheckoutStateIntoToolArgs(functionName, args = {}, checkoutState = {}) {
    if (functionName !== 'create_order') return args

    const state = cloneCheckoutState(checkoutState)
    const collected = state.collected || {}

    return {
        ...args,
        customer_name: args.customer_name || collected.customer_name || args.customer_name,
        customer_phone: args.customer_phone || collected.customer_phone || args.customer_phone,
        email: args.email || collected.email || args.email,
        delivery_address: args.delivery_address || collected.delivery_address || args.delivery_address,
        payment_method: args.payment_method || collected.payment_method || args.payment_method,
        notes: args.notes !== undefined ? args.notes : collected.notes,
    }
}

module.exports = {
    buildCheckoutStateGuidance,
    inferCheckoutStateFromAssistantMessage,
    applyUserReplyToCheckoutState,
    mergeCheckoutStateIntoToolArgs,
}

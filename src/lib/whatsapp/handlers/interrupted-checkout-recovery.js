const {
    CART_STAGE,
    updateCartStateFromUserMessage,
} = require('../services/cart-state.service')
const {
    CHECKOUT_STAGE,
    updateCheckoutStateFromUserMessage,
} = require('../services/checkout-state.service')

const MAX_RECOVERY_LOOKBACK_MESSAGES = 4
const MAX_RECOVERY_DELAY_MS = 6 * 60 * 60 * 1000

function stripQuotedReplyPrefix(text = '') {
    return String(text || '')
        .replace(/^\[En reponse a:\s*".*?"\]\s*/is, '')
        .trim()
}

function hasCheckoutStateData(checkoutState = {}) {
    return checkoutState.stage === CHECKOUT_STAGE.CUSTOMER_FIELDS ||
        checkoutState.stage === CHECKOUT_STAGE.PAYMENT_METHOD ||
        checkoutState.stage === CHECKOUT_STAGE.CUSTOMER_RECAP ||
        checkoutState.stage === CHECKOUT_STAGE.NOTES ||
        checkoutState.stage === CHECKOUT_STAGE.CONFIRMATION ||
        checkoutState.stage === CHECKOUT_STAGE.EDIT_SELECTION ||
        (Array.isArray(checkoutState.pending_fields) && checkoutState.pending_fields.length > 0) ||
        Boolean(checkoutState.awaiting_field) ||
        checkoutState.note_declined === true ||
        checkoutState.customer_recap_confirmed === true ||
        Object.values(checkoutState.collected || {}).some(value => value !== null && value !== '')
}

function isCheckoutAssistantPrompt(text = '') {
    return /quel est votre nom complet|quel est votre numero de telephone|quelle est votre adresse email|vos informations|1\.\s*continuer|2\.\s*modifier une information|recapitulatif|1\.\s*confirmer ma commande|2\.\s*modifier mes informations|3\.\s*modifier le panier/i.test(
        String(text || '')
    )
}

function isRecoveryWindowStillValid(previousAssistantAt, currentUserAt) {
    if (!previousAssistantAt || !currentUserAt) return true

    const assistantTime = new Date(previousAssistantAt).getTime()
    const currentTime = new Date(currentUserAt).getTime()

    if (!Number.isFinite(assistantTime) || !Number.isFinite(currentTime)) return true
    if (currentTime < assistantTime) return false

    return (currentTime - assistantTime) <= MAX_RECOVERY_DELAY_MS
}

function replayInterruptedFlow(historySlice = [], currentStructuredText = '', products = [], currency = 'XOF') {
    let cartState = {}
    let checkoutState = {}
    let checkoutUpdate = {
        state: checkoutState,
        stateChanged: false,
        shouldBypassAI: false,
        directReply: null,
    }

    historySlice.forEach((entry, index) => {
        if (entry.role !== 'user') return

        const replayText = index === historySlice.length - 1
            ? String(currentStructuredText || '').trim()
            : stripQuotedReplyPrefix(entry.content)

        if (!replayText) return

        const previousCartState = cartState
        const cartUpdate = updateCartStateFromUserMessage(cartState, replayText, products, currency)
        const cartJustEnteredCheckout =
            previousCartState.stage !== CART_STAGE.CHECKOUT &&
            cartUpdate.state.stage === CART_STAGE.CHECKOUT

        cartState = cartUpdate.state
        checkoutUpdate = updateCheckoutStateFromUserMessage(checkoutState, replayText, {
            cartState,
            products,
            activateCheckout: cartJustEnteredCheckout,
        })
        checkoutState = checkoutUpdate.state
    })

    return { cartState, checkoutState, checkoutUpdate }
}

function recoverInterruptedCheckoutFromHistory(history = [], currentStructuredText = '', products = [], currency = 'XOF') {
    if (!Array.isArray(history) || history.length < 3 || !String(currentStructuredText || '').trim()) {
        return null
    }

    const currentUserIndex = history.length - 1
    const currentUserEntry = history[currentUserIndex]

    if (currentUserEntry?.role !== 'user') {
        return null
    }

    let previousAssistantIndex = currentUserIndex - 1
    while (previousAssistantIndex >= 0 && history[previousAssistantIndex]?.role !== 'assistant') {
        previousAssistantIndex -= 1
    }

    if (previousAssistantIndex < 0) {
        return null
    }

    const previousAssistant = history[previousAssistantIndex]
    if (!isCheckoutAssistantPrompt(previousAssistant?.content)) {
        return null
    }

    if (!isRecoveryWindowStillValid(previousAssistant?.created_at, currentUserEntry?.created_at)) {
        return null
    }

    const minCandidateIndex = Math.max(0, previousAssistantIndex - MAX_RECOVERY_LOOKBACK_MESSAGES)

    for (let candidateIndex = previousAssistantIndex - 1; candidateIndex >= minCandidateIndex; candidateIndex -= 1) {
        if (history[candidateIndex]?.role !== 'user') continue

        const replay = replayInterruptedFlow(
            history.slice(candidateIndex, currentUserIndex + 1),
            currentStructuredText,
            products,
            currency
        )

        const hasCartLines = Array.isArray(replay.cartState?.cart_items) && replay.cartState.cart_items.length > 0
        if (!hasCartLines) continue
        if (!hasCheckoutStateData(replay.checkoutState)) continue
        if (!replay.checkoutUpdate?.stateChanged && !replay.checkoutUpdate?.shouldBypassAI) continue

        return replay
    }

    return null
}

module.exports = {
    recoverInterruptedCheckoutFromHistory,
}

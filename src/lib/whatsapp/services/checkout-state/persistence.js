const CHECKOUT_STAGE = {
    IDLE: 'idle',
    CUSTOMER_FIELDS: 'customer_fields',
    PAYMENT_METHOD: 'payment_method',
    CUSTOMER_RECAP: 'customer_recap',
    NOTES: 'notes',
    CONFIRMATION: 'confirmation',
    EDIT_SELECTION: 'edit_selection',
}

function cloneAwaitingField(field = null) {
    if (!field) return null
    return { ...field }
}

function cloneCheckoutState(checkout = {}) {
    return {
        stage: checkout.stage || CHECKOUT_STAGE.IDLE,
        pending_fields: Array.isArray(checkout.pending_fields) ? [...checkout.pending_fields] : [],
        awaiting_field: cloneAwaitingField(checkout.awaiting_field),
        collected: {
            customer_name: checkout.collected?.customer_name || null,
            customer_phone: checkout.collected?.customer_phone || null,
            email: checkout.collected?.email || null,
            delivery_address: checkout.collected?.delivery_address || null,
            payment_method: checkout.collected?.payment_method || null,
            notes: checkout.collected?.notes ?? null,
        },
        last_prompt_kind: checkout.last_prompt_kind || null,
        last_prompt_text: checkout.last_prompt_text || null,
        note_declined: checkout.note_declined === true,
        customer_recap_confirmed: checkout.customer_recap_confirmed === true,
        updated_at: checkout.updated_at || null,
    }
}

function getCheckoutState(metadata = {}) {
    return cloneCheckoutState(metadata.checkout || {})
}

function setCheckoutState(metadata = {}, checkoutState) {
    return {
        ...(metadata || {}),
        checkout: {
            ...cloneCheckoutState(checkoutState),
            updated_at: new Date().toISOString(),
        }
    }
}

function clearCheckoutState(metadata = {}) {
    return {
        ...(metadata || {}),
        checkout: null
    }
}

module.exports = {
    CHECKOUT_STAGE,
    cloneAwaitingField,
    cloneCheckoutState,
    getCheckoutState,
    setCheckoutState,
    clearCheckoutState,
}

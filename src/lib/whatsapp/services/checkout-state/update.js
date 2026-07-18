const { normalizeWhatsAppContact } = require('../../ai/tools/tool-helpers')
const { CHECKOUT_STAGE, cloneCheckoutState, cloneAwaitingField } = require('./persistence')
const {
    normalizeFreeText,
    isPositiveReply,
    isNegativeReply,
    looksLikeKnowledgeQuestion,
    extractPhoneFromText,
    extractEmailFromText,
    detectPaymentMethod,
    extractCustomerName,
    extractDeliveryAddress,
    wantsPreviousCustomerValue,
    reusePreviousCustomerValue,
    removePendingField,
    buildAwaitingFieldValidationReply,
} = require('./parsing')
const {
    buildCheckoutContext,
    activateCheckoutState,
    hasCheckoutData,
    recomputeCheckoutProgress,
    buildAwaitingField,
    detectFieldToEdit,
    reopenFieldForEdition,
    buildStructuredCheckoutReply,
} = require('./stage')

function updateCheckoutStateFromUserMessage(previousState, text, options = {}) {
    const {
        cartState = {},
        products = [],
        activateCheckout = false,
        allowKnowledgeInterrupt = false,
        recentCustomerProfile = null,
    } = options

    const context = buildCheckoutContext(cartState, products)
    const hasCartLines = Array.isArray(cartState?.cart_items) && cartState.cart_items.length > 0
    if (!hasCartLines || cartState.stage !== 'checkout') {
        return {
            state: cloneCheckoutState(previousState),
            capturedFields: [],
            stateChanged: false,
            shouldBypassAI: false,
            directReply: null,
            shouldSubmitOrder: false,
            questionDetected: false,
        }
    }

    const previousStructuredState = cloneCheckoutState(previousState)
    let state = activateCheckoutState(previousStructuredState, context)
    const normalizedText = normalizeFreeText(text)
    const capturedFields = []

    if (activateCheckout) {
        state.last_prompt_kind = state.stage
        state.last_prompt_text = normalizedText
        return {
            state,
            capturedFields,
            stateChanged: !hasCheckoutData(previousStructuredState) || JSON.stringify(previousStructuredState) !== JSON.stringify(state),
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products, []),
            shouldSubmitOrder: false,
            questionDetected: false,
        }
    }

    if (!normalizedText) {
        return {
            state,
            capturedFields,
            stateChanged: false,
            shouldBypassAI: false,
            directReply: null,
            shouldSubmitOrder: false,
            questionDetected: false,
        }
    }

    const previousAwaiting = cloneAwaitingField(state.awaiting_field)
    const previousSnapshot = JSON.stringify(state)
    const questionDetected = allowKnowledgeInterrupt && looksLikeKnowledgeQuestion(normalizedText)

    if (questionDetected) {
        return {
            state,
            capturedFields,
            stateChanged: false,
            shouldBypassAI: false,
            directReply: null,
            shouldSubmitOrder: false,
            questionDetected: true,
        }
    }

    if (state.stage === CHECKOUT_STAGE.CONFIRMATION) {
        const isReturnToCart = normalizedText === '3' || /panier|article|produit/i.test(normalizedText)
        const isConfirm = normalizedText === '1' || isPositiveReply(normalizedText)
        const isModify = normalizedText === '2' || isNegativeReply(normalizedText) || /modif/i.test(normalizedText)

        if (isReturnToCart) {
            return {
                state,
                capturedFields,
                stateChanged: false,
                shouldBypassAI: false,
                directReply: null,
                shouldSubmitOrder: false,
                shouldReturnToCart: true,
                questionDetected: false,
            }
        }

        if (isConfirm) {
            state.last_prompt_kind = CHECKOUT_STAGE.CONFIRMATION
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: false,
                directReply: null,
                shouldSubmitOrder: true,
                questionDetected: false,
            }
        }

        if (isModify) {
            state.stage = CHECKOUT_STAGE.EDIT_SELECTION
            state.pending_fields = []
            state.awaiting_field = buildAwaitingField('edit_selection', context)
            state.last_prompt_kind = CHECKOUT_STAGE.EDIT_SELECTION
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products),
                shouldSubmitOrder: false,
                questionDetected: false,
            }
        }

        // Rien compris → réafficher le menu
        return {
            state,
            capturedFields,
            stateChanged: false,
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products),
            shouldSubmitOrder: false,
            questionDetected: false,
        }
    }

    if (state.stage === CHECKOUT_STAGE.EDIT_SELECTION) {
        const fieldToEdit = detectFieldToEdit(normalizedText, context)
        if (fieldToEdit) {
            state = reopenFieldForEdition(state, fieldToEdit, context)
            state.last_prompt_kind = state.stage
            state.last_prompt_text = normalizedText

            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products),
                shouldSubmitOrder: false,
                questionDetected: false,
            }
        }

        return {
            state,
            capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products),
            shouldSubmitOrder: false,
        }
    }

    if (!state.collected.customer_phone) {
        const phone = extractPhoneFromText(normalizedText) || normalizeWhatsAppContact(normalizedText)
        if (phone) {
            state.collected.customer_phone = phone
            removePendingField(state, 'customer_phone')
            capturedFields.push({ type: 'customer_phone', value: phone })
        }
    }

    if (context.requiresEmail && !state.collected.email) {
        const email = extractEmailFromText(normalizedText)
        if (email) {
            state.collected.email = email
            removePendingField(state, 'email')
            capturedFields.push({ type: 'email', value: email })
        }
    }

    if (!state.collected.payment_method) {
        const paymentMethod = detectPaymentMethod(normalizedText)
        if (paymentMethod) {
            state.collected.payment_method = paymentMethod
            removePendingField(state, 'payment_method')
            capturedFields.push({ type: 'payment_method', value: paymentMethod })
        }
    }

    if (state.stage === CHECKOUT_STAGE.CUSTOMER_RECAP) {
        const isContinue = normalizedText === '1' || isPositiveReply(normalizedText)
        const isModify = normalizedText === '2' || /modif/i.test(normalizedText)

        if (isContinue) {
            state.customer_recap_confirmed = true
            state = recomputeCheckoutProgress(state, context)
            state.last_prompt_kind = state.stage
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products),
                shouldSubmitOrder: false,
                questionDetected: false,
            }
        }

        if (isModify) {
            state.stage = CHECKOUT_STAGE.EDIT_SELECTION
            state.pending_fields = []
            state.awaiting_field = buildAwaitingField('edit_selection', context)
            state.last_prompt_kind = CHECKOUT_STAGE.EDIT_SELECTION
            state.last_prompt_text = normalizedText
            return {
                state,
                capturedFields,
            stateChanged: true,
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products),
            shouldSubmitOrder: false,
            questionDetected: false,
        }
    }

        // Rien compris → réafficher le récap
        return {
            state,
            capturedFields,
            stateChanged: false,
            shouldBypassAI: true,
            directReply: buildStructuredCheckoutReply(state, cartState, products),
            shouldSubmitOrder: false,
        }
    }

    if (state.stage === CHECKOUT_STAGE.NOTES) {
        state.note_declined = isNegativeReply(normalizedText)
        state.collected.notes = state.note_declined ? '' : normalizedText
        removePendingField(state, 'notes')
        capturedFields.push({ type: 'notes', value: state.note_declined ? 'Aucune' : normalizedText })
    } else if (state.stage === CHECKOUT_STAGE.CUSTOMER_FIELDS) {
        const awaitingType = state.awaiting_field?.type
        if (
            awaitingType &&
            wantsPreviousCustomerValue(normalizedText, awaitingType) &&
            reusePreviousCustomerValue(state, awaitingType, recentCustomerProfile, capturedFields)
        ) {
            state = recomputeCheckoutProgress(state, context)
            state.last_prompt_kind = state.stage
            state.last_prompt_text = normalizedText

            return {
                state,
                capturedFields,
                stateChanged: true,
                shouldBypassAI: true,
                directReply: buildStructuredCheckoutReply(state, cartState, products, capturedFields),
                shouldSubmitOrder: false,
                questionDetected: false,
            }
        }

        // Split on commas/semicolons/newlines BEFORE any phone removal (removePhoneFromText
        // destroys commas, making multi-field detection fail).
        const rawSegments = normalizedText.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean)
        const isMultiSegment = rawSegments.length > 1

        // Filter out segments that were already captured as phone or email
        const textSegments = rawSegments.filter(segment => {
            if (extractPhoneFromText(segment)) return false
            if (context.requiresEmail && extractEmailFromText(segment)) return false
            return true
        })

        if (isMultiSegment) {
            // Multiple comma-separated segments: assign in order name → address
            for (const segment of textSegments) {
                if (state.pending_fields.includes('customer_name') && !state.collected.customer_name) {
                    const name = extractCustomerName(segment)
                    if (name) {
                        const capitalizedName = name.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
                        state.collected.customer_name = capitalizedName
                        removePendingField(state, 'customer_name')
                        capturedFields.push({ type: 'customer_name', value: capitalizedName })
                        continue
                    }
                }
                if (context.requiresAddress && state.pending_fields.includes('delivery_address') && !state.collected.delivery_address) {
                    const address = extractDeliveryAddress(segment)
                    if (address) {
                        state.collected.delivery_address = address
                        removePendingField(state, 'delivery_address')
                        capturedFields.push({ type: 'delivery_address', value: address })
                    }
                }
            }
        } else if (textSegments.length === 1) {
            // Single text segment: use awaiting_field.type as context hint
            const segment = textSegments[0]
            const awaitingType = state.awaiting_field?.type

            if (awaitingType === 'delivery_address' || (!state.pending_fields.includes('customer_name') && context.requiresAddress)) {
                // Bot was asking for address, or name already collected
                const address = extractDeliveryAddress(segment)
                if (address && !state.collected.delivery_address) {
                    state.collected.delivery_address = address
                    removePendingField(state, 'delivery_address')
                    capturedFields.push({ type: 'delivery_address', value: address })
                }
            } else {
                // Bot was asking for name (or anything else)
                const name = extractCustomerName(segment, true) // lenient: accept 1 token
                if (name && state.pending_fields.includes('customer_name') && !state.collected.customer_name) {
                    const capitalizedName = name.split(' ').map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w).join(' ')
                    state.collected.customer_name = capitalizedName
                    removePendingField(state, 'customer_name')
                    capturedFields.push({ type: 'customer_name', value: capitalizedName })
                } else if (context.requiresAddress && state.pending_fields.includes('delivery_address') && !state.collected.delivery_address) {
                    // Name extraction failed (too many tokens?) → try as address
                    const address = extractDeliveryAddress(segment)
                    if (address) {
                        state.collected.delivery_address = address
                        removePendingField(state, 'delivery_address')
                        capturedFields.push({ type: 'delivery_address', value: address })
                    }
                }
            }
        }
    }

    state = recomputeCheckoutProgress(state, context)
    state.last_prompt_kind = state.stage
    state.last_prompt_text = normalizedText

    const awaitingChanged = JSON.stringify(previousAwaiting) !== JSON.stringify(state.awaiting_field)
    const stateChanged = previousSnapshot !== JSON.stringify(state)
    const shouldBypassAI = stateChanged || awaitingChanged
    const validationReply = (
        capturedFields.length === 0 &&
        previousAwaiting?.type &&
        previousAwaiting.type === state.awaiting_field?.type
    )
        ? buildAwaitingFieldValidationReply(previousAwaiting, normalizedText)
        : null

    return {
        state,
        capturedFields,
        stateChanged: stateChanged || awaitingChanged,
        shouldBypassAI: shouldBypassAI || Boolean(validationReply),
        directReply: validationReply || (shouldBypassAI
            ? buildStructuredCheckoutReply(state, cartState, products, capturedFields)
            : null),
        shouldSubmitOrder: false,
        questionDetected: false,
    }
}

module.exports = {
    updateCheckoutStateFromUserMessage,
}

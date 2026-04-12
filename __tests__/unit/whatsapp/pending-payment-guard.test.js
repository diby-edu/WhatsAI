const {
    assistantPromptWasPaymentLink,
    assistantPromptWasPendingChoice,
    buildPendingPaymentCancellationFailedMessage,
    buildPendingPaymentChoicePrompt,
    buildPendingPaymentReminder,
    findPendingOnlineOrder,
    isAmbiguousPendingPaymentReply,
    isExplicitNewOrderIntent,
    isPaymentHelpIntent,
    resolvePendingPaymentFollowUp,
} = require('../../../src/lib/whatsapp/handlers/pending-payment-guard')

describe('pending payment guard', () => {
    const pendingOrder = {
        id: 'abcd1234-5678',
        total_fcfa: 150,
        status: 'pending',
        payment_method: 'online',
        provider_payment_url: null,
        conversation_id: 'conv-1',
    }

    test('detects short ambiguous replies that should not reopen a cart flow', () => {
        expect(isAmbiguousPendingPaymentReply('1')).toBe(true)
        expect(isAmbiguousPendingPaymentReply('oui')).toBe(true)
        expect(isAmbiguousPendingPaymentReply('Je veux 1 logiciel antivirus')).toBe(false)
    })

    test('detects payment-link and choice assistant prompts', () => {
        expect(assistantPromptWasPaymentLink('Commande creee ! Voici le lien de paiement securise : https://wazzapai.com/pay/abc')).toBe(true)
        expect(assistantPromptWasPaymentLink('Quel est votre nom complet ?')).toBe(false)

        const choicePrompt = buildPendingPaymentChoicePrompt(pendingOrder)
        expect(assistantPromptWasPendingChoice(choicePrompt)).toBe(true)
        expect(assistantPromptWasPendingChoice('Voici votre panier')).toBe(false)
    })

    test('prefers the pending online order from the same conversation', () => {
        const order = findPendingOnlineOrder([
            {
                id: 'older-order',
                status: 'pending',
                payment_method: 'online',
                conversation_id: 'old-conv',
                created_at: '2026-04-12T10:00:00.000Z',
            },
            {
                ...pendingOrder,
                created_at: '2026-04-12T10:05:00.000Z',
            },
        ], {
            conversationId: 'conv-1',
        })

        expect(order?.id).toBe('abcd1234-5678')
    })

    test('classifies payment help and explicit new order intents separately', () => {
        expect(isPaymentHelpIntent('le lien ne marche pas')).toBe(true)
        expect(isPaymentHelpIntent('je paie plus tard')).toBe(true)
        expect(isPaymentHelpIntent('bonjour')).toBe(false)

        expect(isExplicitNewOrderIntent('Je veux encore 1 logiciel antivirus', ['Logiciel Antivirus', 'Mini-cours Excel'])).toBe(true)
        expect(isExplicitNewOrderIntent('Le logiciel antivirus est compatible ?', ['Logiciel Antivirus'])).toBe(false)
    })

    test('returns a reminder for ambiguous replies while payment is pending', () => {
        const resolution = resolvePendingPaymentFollowUp({
            text: '1',
            lastAssistantMessage: 'Commande creee ! Voici le lien de paiement securise : https://wazzapai.com/pay/abcd1234-5678',
            pendingOrder,
            productNames: ['Logiciel Antivirus'],
        })

        expect(resolution).toEqual(expect.objectContaining({ type: 'reminder' }))
        expect(resolution.content).toContain('https://wazzapai.com/pay/abcd1234-5678')
    })

    test('returns a choice prompt for explicit new order attempts while payment is pending', () => {
        const resolution = resolvePendingPaymentFollowUp({
            text: 'Je veux encore 1 logiciel antivirus',
            lastAssistantMessage: 'Commande creee ! Voici le lien de paiement securise : https://wazzapai.com/pay/abcd1234-5678',
            pendingOrder,
            productNames: ['Logiciel Antivirus'],
        })

        expect(resolution).toEqual(expect.objectContaining({ type: 'choice' }))
        expect(resolution.content).toContain('1. Continuer le paiement')
        expect(resolution.content).toContain('2. Annuler cette commande')
    })

    test('interprets the follow-up choice menu correctly', () => {
        const choicePrompt = buildPendingPaymentChoicePrompt(pendingOrder)

        const continueResolution = resolvePendingPaymentFollowUp({
            text: '1',
            lastAssistantMessage: choicePrompt,
            pendingOrder,
            productNames: ['Logiciel Antivirus'],
        })
        expect(continueResolution).toEqual(expect.objectContaining({ type: 'reminder' }))

        const cancelResolution = resolvePendingPaymentFollowUp({
            text: '2',
            lastAssistantMessage: choicePrompt,
            pendingOrder,
            productNames: ['Logiciel Antivirus'],
        })
        expect(cancelResolution).toEqual(expect.objectContaining({ type: 'cancel_pending_order' }))
    })

    test('builds fallback texts for reminders and cancellation failures', () => {
        const reminder = buildPendingPaymentReminder(pendingOrder, '+2250606060606')
        expect(reminder).toContain('#abcd1234')
        expect(reminder).toContain('+2250606060606')

        const failed = buildPendingPaymentCancellationFailedMessage(pendingOrder)
        expect(failed).toContain('#abcd1234')
    })
})

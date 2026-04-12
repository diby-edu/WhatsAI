const {
    assistantPromptWasPaymentLink,
    buildPendingPaymentReminder,
    findPendingOnlineOrder,
    isAmbiguousPendingPaymentReply,
    shouldHandlePendingPaymentFollowUp,
} = require('../../../src/lib/whatsapp/handlers/pending-payment-guard')

describe('pending payment guard', () => {
    test('detects short ambiguous replies that should not reopen a cart flow', () => {
        expect(isAmbiguousPendingPaymentReply('1')).toBe(true)
        expect(isAmbiguousPendingPaymentReply('oui')).toBe(true)
        expect(isAmbiguousPendingPaymentReply('Je veux 1 logiciel antivirus')).toBe(false)
        expect(isAmbiguousPendingPaymentReply('le lien ne marche pas')).toBe(false)
    })

    test('detects payment-link assistant prompts', () => {
        expect(assistantPromptWasPaymentLink('✅ Commande créée ! Voici le lien de paiement sécurisé pour 75 FCFA :\nhttps://wazzapai.com/pay/abc')).toBe(true)
        expect(assistantPromptWasPaymentLink('Quel est votre nom complet ?')).toBe(false)
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
                id: 'target-order',
                status: 'pending',
                payment_method: 'online',
                conversation_id: 'current-conv',
                created_at: '2026-04-12T10:05:00.000Z',
            },
        ], {
            conversationId: 'current-conv',
        })

        expect(order?.id).toBe('target-order')
    })

    test('builds a reminder only for ambiguous follow-ups after a payment link', () => {
        const pendingOrder = {
            id: 'abcd1234-5678',
            total_fcfa: 150,
            status: 'pending',
            payment_method: 'online',
            provider_payment_url: null,
        }

        expect(shouldHandlePendingPaymentFollowUp({
            text: '1',
            lastAssistantMessage: '✅ Commande créée ! Voici le lien de paiement sécurisé : https://wazzapai.com/pay/abcd1234-5678',
            pendingOrder,
        })).toBe(true)

        expect(shouldHandlePendingPaymentFollowUp({
            text: 'Je veux encore 1 logiciel antivirus',
            lastAssistantMessage: '✅ Commande créée ! Voici le lien de paiement sécurisé : https://wazzapai.com/pay/abcd1234-5678',
            pendingOrder,
        })).toBe(false)

        const reminder = buildPendingPaymentReminder(pendingOrder, '+2250606060606')
        expect(reminder).toContain('#abcd1234')
        expect(reminder).toContain('https://wazzapai.com/pay/abcd1234-5678')
        expect(reminder).toContain('+2250606060606')
    })
})

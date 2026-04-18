const {
    shouldBypassTransactionalFlow,
    shouldPersistTransactionalMetadataAfterResponse,
} = require('../../../src/lib/whatsapp/handlers/transactional-state-guard')

describe('transactional state guard', () => {
    test('bypasses transactional flow when a pending-payment guard owns the reply', () => {
        expect(shouldBypassTransactionalFlow({
            pendingPaymentResolution: { type: 'choice' },
            activeTunnelCancellation: null,
        })).toBe(true)
    })

    test('bypasses transactional flow when an active tunnel cancellation owns the reply', () => {
        expect(shouldBypassTransactionalFlow({
            pendingPaymentResolution: null,
            activeTunnelCancellation: { type: 'cancel_active_tunnel' },
        })).toBe(true)
    })

    test('skips metadata persistence for non-cancelling pending-payment replies', () => {
        expect(shouldPersistTransactionalMetadataAfterResponse({
            pendingPaymentResolution: { type: 'reminder' },
            activeTunnelCancellation: null,
        })).toBe(false)

        expect(shouldPersistTransactionalMetadataAfterResponse({
            pendingPaymentResolution: { type: 'choice' },
            activeTunnelCancellation: null,
        })).toBe(false)
    })

    test('keeps metadata persistence for cancellation replies that must clear state', () => {
        expect(shouldPersistTransactionalMetadataAfterResponse({
            pendingPaymentResolution: { type: 'cancelled' },
            activeTunnelCancellation: null,
        })).toBe(true)

        expect(shouldPersistTransactionalMetadataAfterResponse({
            pendingPaymentResolution: null,
            activeTunnelCancellation: { type: 'cancel_active_tunnel' },
        })).toBe(true)
    })
})

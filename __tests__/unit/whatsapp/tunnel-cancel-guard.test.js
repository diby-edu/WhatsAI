const {
    buildActiveTunnelCancelledMessage,
    isGlobalTunnelCancelIntent,
    resolveActiveTunnelCancellation,
} = require('../../../src/lib/whatsapp/handlers/tunnel-cancel-guard')

describe('tunnel cancel guard', () => {
    test('detects explicit cancellation phrases', () => {
        expect(isGlobalTunnelCancelIntent('annuler')).toBe(true)
        expect(isGlobalTunnelCancelIntent('Je veux annuler la commande')).toBe(true)
        expect(isGlobalTunnelCancelIntent('laisse tomber cette commande')).toBe(true)
    })

    test('ignores ambiguous numeric replies', () => {
        expect(isGlobalTunnelCancelIntent('2')).toBe(false)
        expect(isGlobalTunnelCancelIntent('1')).toBe(false)
        expect(isGlobalTunnelCancelIntent('continuer')).toBe(false)
    })

    test('returns null when no transactional tunnel is active', () => {
        const resolution = resolveActiveTunnelCancellation({
            text: 'annuler la commande',
            hasCartState: false,
            hasCheckoutState: false,
        })

        expect(resolution).toBeNull()
    })

    test('cancels when cart state is active', () => {
        const resolution = resolveActiveTunnelCancellation({
            text: 'annuler la commande',
            hasCartState: true,
            hasCheckoutState: false,
        })

        expect(resolution).toEqual({
            type: 'cancel_active_tunnel',
            content: buildActiveTunnelCancelledMessage(),
        })
    })

    test('cancels when checkout state is active', () => {
        const resolution = resolveActiveTunnelCancellation({
            text: 'je veux annuler',
            hasCartState: false,
            hasCheckoutState: true,
        })

        expect(resolution).toEqual({
            type: 'cancel_active_tunnel',
            content: buildActiveTunnelCancelledMessage(),
        })
    })
})

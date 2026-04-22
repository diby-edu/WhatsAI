describe('feexpay network resolver', () => {
    test('uses explicit network when valid and aligned with country', () => {
        const { resolveFeexPaySelection } = require('@/lib/payments/feexpay-networks')

        const selection = resolveFeexPaySelection({
            country: 'CI',
            network: 'wave_ci',
            phone: '+2250747094746',
            defaultNetwork: '',
        })

        expect(selection).toEqual({
            countryCode: 'CI',
            networkCode: 'wave_ci',
            error: null,
        })
    })

    test('rejects mismatched network/country pairs', () => {
        const { resolveFeexPaySelection } = require('@/lib/payments/feexpay-networks')

        const selection = resolveFeexPaySelection({
            country: 'SN',
            network: 'wave_ci',
            phone: '+2250747094746',
            defaultNetwork: '',
        })

        expect(selection).toEqual({
            countryCode: null,
            networkCode: null,
            error: 'NETWORK_COUNTRY_MISMATCH',
        })
    })

    test('infers country from phone and falls back to a valid network', () => {
        const { resolveFeexPaySelection } = require('@/lib/payments/feexpay-networks')

        const selection = resolveFeexPaySelection({
            country: '',
            network: '',
            phone: '+221771234567',
            defaultNetwork: '',
        })

        expect(selection.countryCode).toBe('SN')
        expect(['orange_sn', 'wave_sn', 'free_sn']).toContain(selection.networkCode)
        expect(selection.error).toBeNull()
    })
})

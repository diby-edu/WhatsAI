describe('payment mode display helpers', () => {
    test('formats known payment providers', () => {
        const { formatPaymentProviderLabel } = require('@/lib/payments/payment-mode-display')

        expect(formatPaymentProviderLabel('paystack')).toBe('Paystack')
        expect(formatPaymentProviderLabel('cinetpay')).toBe('CinetPay')
        expect(formatPaymentProviderLabel(null)).toBeNull()
    })

    test('resolves hosted online payment display', () => {
        const { resolveOrderPaymentDisplay } = require('@/lib/payments/payment-mode-display')

        expect(resolveOrderPaymentDisplay({
            paymentMethod: 'online',
            agentPaymentMode: 'cinetpay',
            paymentProvider: 'paystack',
        })).toEqual({
            mode: 'online',
            modeLabel: 'En ligne',
            providerLabel: 'Paystack',
            usesHostedProvider: true,
        })
    })

    test('resolves manual payment display', () => {
        const { resolveOrderPaymentDisplay } = require('@/lib/payments/payment-mode-display')

        expect(resolveOrderPaymentDisplay({
            paymentMethod: 'mobile_money_direct',
            agentPaymentMode: 'mobile_money_direct',
            paymentProvider: 'paystack',
        })).toEqual({
            mode: 'manual',
            modeLabel: 'Manuel',
            providerLabel: null,
            usesHostedProvider: false,
        })
    })

    test('resolves cash on delivery labels by fulfillment', () => {
        const { resolveOrderPaymentDisplay } = require('@/lib/payments/payment-mode-display')

        expect(resolveOrderPaymentDisplay({
            paymentMethod: 'cod',
            fulfillmentMode: 'delivery',
        }).modeLabel).toBe('A la livraison')

        expect(resolveOrderPaymentDisplay({
            paymentMethod: 'cod',
            fulfillmentMode: 'takeaway',
        }).modeLabel).toBe('Au retrait')
    })

    test('parses legacy and semantic agent payment modes safely', () => {
        const {
            parseAgentPaymentMode,
            coerceAgentPaymentModeOrThrow,
        } = require('@/lib/payments/payment-mode-display')

        expect(parseAgentPaymentMode('cinetpay')).toBe('cinetpay')
        expect(parseAgentPaymentMode('hosted_link')).toBe('cinetpay')
        expect(parseAgentPaymentMode('manual')).toBe('mobile_money_direct')
        expect(parseAgentPaymentMode('mobile_money_direct')).toBe('mobile_money_direct')
        expect(parseAgentPaymentMode('unknown_mode')).toBeNull()

        expect(coerceAgentPaymentModeOrThrow('hosted_link')).toBe('cinetpay')
        expect(() => coerceAgentPaymentModeOrThrow('unexpected')).toThrow(/unsupported agent payment mode/i)
    })
})

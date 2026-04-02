describe('paystack helpers', () => {
    const originalFetch = global.fetch
    const originalSecret = process.env.PAYSTACK_SECRET_KEY

    beforeEach(() => {
        jest.resetModules()
        process.env.PAYSTACK_SECRET_KEY = 'sk_test_123'
        global.fetch = jest.fn()
    })

    afterEach(() => {
        global.fetch = originalFetch
        process.env.PAYSTACK_SECRET_KEY = originalSecret
    })

    test('converts FCFA major units to Paystack subunits', () => {
        const { toPaystackSubunitAmount } = require('@/lib/payments/paystack')
        expect(toPaystackSubunitAmount(5000)).toBe(500000)
        expect(toPaystackSubunitAmount(17600)).toBe(1760000)
    })

    test('initializes a paystack hosted payment with authorization_url', async () => {
        const { initializePaystackPayment } = require('@/lib/payments/paystack')
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                status: true,
                data: {
                    authorization_url: 'https://checkout.paystack.com/abc123',
                    access_code: 'ACCESS_123',
                    reference: 'ORD_123'
                }
            })
        })

        const result = await initializePaystackPayment({
            amountFcfa: 5000,
            currency: 'XOF',
            reference: 'ORD_123',
            description: 'Commande test',
            customerName: 'Client Test',
            customerPhone: '+2250701020304',
            callbackUrl: 'https://wazzapai.com/pay/order_123'
        })

        expect(result).toEqual(expect.objectContaining({
            success: true,
            paymentUrl: 'https://checkout.paystack.com/abc123',
            reference: 'ORD_123'
        }))

        const [, options] = global.fetch.mock.calls[0]
        const body = JSON.parse(options.body)
        expect(body.amount).toBe(500000)
        expect(body.currency).toBe('XOF')
        expect(body.reference).toBe('ORD_123')
    })

    test('verifies a successful paystack transaction', async () => {
        const { verifyPaystackTransaction } = require('@/lib/payments/paystack')
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                status: true,
                data: {
                    status: 'success',
                    amount: 500000,
                    gateway_response: 'Successful'
                }
            })
        })

        const result = await verifyPaystackTransaction('ORD_123')

        expect(result).toEqual(expect.objectContaining({
            success: true,
            status: 'ACCEPTED',
            transactionId: 'ORD_123',
            amount: 5000
        }))
    })

    test('extracts a mobile money channel with provider detail from nested payloads', () => {
        const { extractPaystackChannelInfo } = require('@/lib/payments/paystack')

        const result = extractPaystackChannelInfo({
            webhook: {
                data: {
                    channel: 'mobile_money'
                }
            },
            verification: {
                data: {
                    authorization: {
                        bank: 'Wave'
                    }
                }
            }
        })

        expect(result).toEqual({
            paymentChannel: 'mobile_money',
            paymentChannelDetail: 'Wave'
        })
    })

    test('extracts card brand as display detail when available', () => {
        const { extractPaystackChannelInfo } = require('@/lib/payments/paystack')

        const result = extractPaystackChannelInfo({
            data: {
                channel: 'card',
                authorization: {
                    brand: 'Visa'
                }
            }
        })

        expect(result).toEqual({
            paymentChannel: 'card',
            paymentChannelDetail: 'Visa'
        })
    })
})

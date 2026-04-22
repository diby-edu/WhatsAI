const crypto = require('crypto')

function createHeaders(values = {}) {
    const normalized = Object.entries(values).reduce((acc, [key, value]) => {
        acc[String(key || '').toLowerCase()] = String(value || '')
        return acc
    }, {})

    return {
        get(headerName) {
            return normalized[String(headerName || '').toLowerCase()] || null
        }
    }
}

describe('feexpay helpers', () => {
    const originalFetch = global.fetch
    const originalEnv = { ...process.env }

    beforeEach(() => {
        jest.resetModules()
        global.fetch = jest.fn()
        process.env = {
            ...originalEnv,
            FEEXPAY_API_KEY: 'fp_test_123',
            FEEXPAY_SHOP_ID: 'shop_test_123',
            FEEXPAY_API_BASE_URL: 'https://api-v2.feexpay.me/api',
            FEEXPAY_STATUS_BASE_URL: 'https://api.feexpay.me/api',
            FEEXPAY_DEFAULT_NETWORK: 'free_sn',
            FEEXPAY_DEFAULT_OTP: '',
            FEEXPAY_WEBHOOK_SECRET: '',
        }
    })

    afterEach(() => {
        global.fetch = originalFetch
        process.env = { ...originalEnv }
    })

    test('initializes hosted free_sn payment and recovers payment_url from status lookup when missing', async () => {
        const { initializeFeexPayPayment } = require('@/lib/payments/feexpay')

        global.fetch
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    reference: 'ref_free_sn_001',
                    message: 'Accepted',
                    status: 'PENDING',
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({
                    data: {
                        status: 'PENDING',
                        payment_url: 'https://pay.free.sn/checkout/abc123',
                    },
                }),
            })

        const result = await initializeFeexPayPayment({
            amountFcfa: 19900,
            transactionId: 'ORD_123',
            description: 'Commande test free_sn',
            customerName: 'Client Demo',
            customerPhone: '+225 07 47 09 47 46',
            returnUrl: 'https://wazzapai.com/pay/order_123',
            failedUrl: 'https://wazzapai.com/pay/order_123?payment=cancelled',
            metadata: { network: 'free_sn' },
        })

        expect(result).toEqual(expect.objectContaining({
            success: true,
            reference: 'ref_free_sn_001',
            paymentUrl: 'https://pay.free.sn/checkout/abc123',
        }))

        expect(global.fetch).toHaveBeenCalledTimes(2)

        const [initUrl, initOptions] = global.fetch.mock.calls[0]
        expect(initUrl).toContain('/transactions/public/requesttopay/free_sn')
        const initBody = JSON.parse(initOptions.body)
        expect(initBody).toEqual(expect.objectContaining({
            shop: 'shop_test_123',
            amount: 19900,
            phoneNumber: '2250747094746',
            firstName: 'Client',
            lastName: 'Demo',
            first_name: 'Client',
            last_name: 'Demo',
            callback_info: 'ORD_123',
            return_url: 'https://wazzapai.com/pay/order_123',
            cancel_url: 'https://wazzapai.com/pay/order_123?payment=cancelled',
        }))

        const [statusUrl] = global.fetch.mock.calls[1]
        expect(statusUrl).toContain('/transactions/public/single/status/ref_free_sn_001')
    })

    test('returns explicit error when network requires otp and none is configured', async () => {
        process.env.FEEXPAY_DEFAULT_NETWORK = 'orange_sn'
        process.env.FEEXPAY_DEFAULT_OTP = ''
        const { initializeFeexPayPayment } = require('@/lib/payments/feexpay')

        const result = await initializeFeexPayPayment({
            amountFcfa: 1000,
            transactionId: 'ORD_OTP_001',
            description: 'Commande OTP',
            customerName: 'Client OTP',
            customerPhone: '+221771234567',
            returnUrl: 'https://wazzapai.com/pay/order_otp',
        })

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/requiert un OTP/i)
        expect(global.fetch).not.toHaveBeenCalled()
    })

    test('verifies webhook signature when secret is configured', () => {
        process.env.FEEXPAY_WEBHOOK_SECRET = 'whsec_demo_123'
        const { verifyFeexPayWebhookSignature } = require('@/lib/payments/feexpay')

        const rawBody = JSON.stringify({ reference: 'ref_demo' })
        const signature = crypto
            .createHmac('sha256', 'whsec_demo_123')
            .update(rawBody)
            .digest('hex')

        const validHeaders = createHeaders({ 'x-feexpay-signature': signature })
        expect(verifyFeexPayWebhookSignature(rawBody, validHeaders)).toEqual({
            ok: true,
            mode: 'strict',
        })

        const invalidHeaders = createHeaders({ 'x-feexpay-signature': 'invalid_signature' })
        expect(verifyFeexPayWebhookSignature(rawBody, invalidHeaders)).toEqual({
            ok: false,
            mode: 'strict',
        })
    })

    test('keeps webhook verification disabled when no secret is configured', () => {
        process.env.FEEXPAY_WEBHOOK_SECRET = ''
        const { verifyFeexPayWebhookSignature } = require('@/lib/payments/feexpay')

        expect(verifyFeexPayWebhookSignature('{"a":1}', createHeaders())).toEqual({
            ok: true,
            mode: 'disabled',
        })
    })
})

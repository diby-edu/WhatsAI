const crypto = require('crypto')

describe('paydunya helpers', () => {
    const originalFetch = global.fetch
    const originalEnv = { ...process.env }

    beforeEach(() => {
        jest.resetModules()
        global.fetch = jest.fn()
        process.env = {
            ...originalEnv,
            PAYDUNYA_MASTER_KEY: 'master_key_demo',
            PAYDUNYA_PRIVATE_KEY: 'private_key_demo',
            PAYDUNYA_PUBLIC_KEY: 'public_key_demo',
            PAYDUNYA_TOKEN: 'token_demo',
            PAYDUNYA_MODE: 'live',
            PAYDUNYA_STORE_NAME: 'WazzapAI',
            NEXT_PUBLIC_APP_URL: 'https://wazzapai.com',
        }
    })

    afterEach(() => {
        global.fetch = originalFetch
        process.env = { ...originalEnv }
    })

    test('initializes checkout invoice and returns payment url + token', async () => {
        const { initializePayDunyaPayment } = require('@/lib/payments/paydunya')

        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                response_code: '00',
                response_text: 'https://app.paydunya.com/checkout/invoice/token_001',
                token: 'token_001',
                description: 'Checkout invoice created',
            }),
        })

        const result = await initializePayDunyaPayment({
            amountFcfa: 12500,
            transactionId: 'ORD_ABC_123',
            description: 'Commande test',
            customerName: 'Client Test',
            customerEmail: '[email protected]',
            customerPhone: '+2250700000000',
            returnUrl: 'https://wazzapai.com/pay/ord-abc-123',
            failedUrl: 'https://wazzapai.com/pay/ord-abc-123?payment=cancelled',
            notifyUrl: 'https://wazzapai.com/api/payments/paydunya/webhook',
            metadata: { order_id: 'ord-abc-123' },
        })

        expect(result).toEqual(expect.objectContaining({
            success: true,
            token: 'token_001',
            paymentUrl: 'https://app.paydunya.com/checkout/invoice/token_001',
        }))

        expect(global.fetch).toHaveBeenCalledTimes(1)
        const [url, options] = global.fetch.mock.calls[0]
        expect(url).toContain('/checkout-invoice/create')
        expect(options.headers).toEqual(expect.objectContaining({
            'PAYDUNYA-MASTER-KEY': 'master_key_demo',
            'PAYDUNYA-PRIVATE-KEY': 'private_key_demo',
            'PAYDUNYA-TOKEN': 'token_demo',
        }))

        const body = JSON.parse(options.body)
        expect(body.custom_data).toEqual(expect.objectContaining({
            transaction_id: 'ORD_ABC_123',
            internal_transaction_id: 'ORD_ABC_123',
            order_id: 'ord-abc-123',
        }))
    })

    test('verifies transaction from confirm endpoint', async () => {
        const { verifyPayDunyaTransaction } = require('@/lib/payments/paydunya')

        global.fetch.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                response_code: '00',
                invoice: {
                    token: 'token_200',
                    status: 'completed',
                    total_amount: 100,
                },
            }),
        })

        const result = await verifyPayDunyaTransaction('token_200')
        expect(result).toEqual(expect.objectContaining({
            success: true,
            status: 'ACCEPTED',
            transactionId: 'token_200',
            amount: 100,
        }))
    })

    test('parses form-encoded webhook and validates hash', () => {
        const {
            extractPayDunyaWebhookAmount,
            extractPayDunyaWebhookHash,
            extractPayDunyaWebhookInternalReference,
            extractPayDunyaWebhookReference,
            extractPayDunyaWebhookStatus,
            parsePayDunyaWebhookPayload,
            verifyPayDunyaWebhookHash,
        } = require('@/lib/payments/paydunya')

        const hash = crypto
            .createHash('sha512')
            .update('master_key_demo')
            .digest('hex')

        const payload = parsePayDunyaWebhookPayload(
            `data[hash]=${hash}&data[invoice][token]=token_webhook_1&data[invoice][status]=completed&data[invoice][total_amount]=12500&data[custom_data][transaction_id]=ORD_WEBHOOK_001`,
            'application/x-www-form-urlencoded'
        )

        expect(verifyPayDunyaWebhookHash(extractPayDunyaWebhookHash(payload))).toBe(true)
        expect(extractPayDunyaWebhookReference(payload)).toBe('token_webhook_1')
        expect(extractPayDunyaWebhookInternalReference(payload)).toBe('ORD_WEBHOOK_001')
        expect(extractPayDunyaWebhookStatus(payload)).toBe('ACCEPTED')
        expect(extractPayDunyaWebhookAmount(payload)).toBe(12500)
    })
})

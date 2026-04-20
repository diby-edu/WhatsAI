const {
    detectProviderFromRequest,
    normalizeWebhookEvent,
} = require('@/lib/api/platform-webhook-normalizer')

describe('platform webhook normalizer', () => {
    test('detects Shopify from webhook header and maps order create', () => {
        const headers = new Headers({ 'x-shopify-topic': 'orders/create' })
        const body = { id: 'shp_evt_1' }

        const detected = detectProviderFromRequest(headers, body)
        expect(detected).toEqual({
            provider: 'shopify',
            providerEvent: 'orders/create',
        })

        const normalized = normalizeWebhookEvent(detected.provider, detected.providerEvent, {
            id: '9876',
            name: '#CMD-9876',
            total_price: '12500',
            currency: 'FCFA',
            customer: {
                first_name: 'Koffi',
                last_name: 'Diby',
                phone: '+2250700000000',
                email: 'koffi@example.com',
            },
        })

        expect(normalized.triggerEvent).toBe('order_created')
        expect(normalized.customer.phone).toBe('+2250700000000')
        expect(normalized.order.reference).toBe('#CMD-9876')
    })

    test('detects WooCommerce from webhook header and maps order created', () => {
        const headers = new Headers({ 'x-wc-webhook-topic': 'order.created' })
        const detected = detectProviderFromRequest(headers, {})

        const normalized = normalizeWebhookEvent(detected.provider, detected.providerEvent, {
            id: 4587,
            number: 'CMD-4587',
            total: '12500',
            billing: {
                first_name: 'Client',
                last_name: 'Test',
                phone: '+2250554585927',
                email: 'client@example.com',
            },
        })

        expect(detected.provider).toBe('woocommerce')
        expect(normalized.triggerEvent).toBe('order_created')
        expect(normalized.customer.phone).toBe('+2250554585927')
        expect(normalized.order.id).toBe('4587')
    })

    test('supports explicit provider/body fallback for Chariow naming', () => {
        const headers = new Headers()
        const detected = detectProviderFromRequest(headers, {
            provider: 'chariow',
            event: 'successful.sale',
        })

        const normalized = normalizeWebhookEvent(detected.provider, detected.providerEvent, {
            sale: {
                id: 'sale_99',
                reference: 'SL-99',
                total: 5000,
            },
            customer: {
                phone: '+2250102030405',
                name: 'Client Chariow',
            },
        })

        expect(detected.provider).toBe('chariow')
        expect(normalized.triggerEvent).toBe('order_created')
        expect(normalized.order.reference).toBe('SL-99')
    })
})

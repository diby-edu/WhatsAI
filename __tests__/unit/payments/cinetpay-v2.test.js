describe('cinetpay-v2 helpers', () => {
    const originalEnv = { ...process.env }

    beforeEach(() => {
        jest.resetModules()
        process.env.CINETPAY_V2_ENABLED = 'true'
        process.env.CINETPAY_V2_ACCOUNT_KEY = 'test-key'
        process.env.CINETPAY_V2_ACCOUNT_PASSWORD = 'test-password'
        process.env.CINETPAY_V2_TEST_AGENT_IDS = 'agent_a,agent_b'
        process.env.CINETPAY_V2_FALLBACK_EMAIL_DOMAIN = 'wazzapai.com'
    })

    afterEach(() => {
        process.env = { ...originalEnv }
    })

    test('allows only configured test agents when v2 is enabled', () => {
        const { shouldUseCinetPayV2ForAgent } = require('../../../src/lib/payments/cinetpay-v2')

        expect(shouldUseCinetPayV2ForAgent('agent_a')).toBe(true)
        expect(shouldUseCinetPayV2ForAgent('agent_b')).toBe(true)
        expect(shouldUseCinetPayV2ForAgent('agent_c')).toBe(false)
    })

    test('splits customer name and generates fallback email from phone', () => {
        const {
            splitCustomerName,
            buildFallbackCustomerEmail,
        } = require('../../../src/lib/payments/cinetpay-v2')

        expect(splitCustomerName('Koffi Diby')).toEqual({
            firstName: 'Koffi',
            lastName: 'Diby'
        })

        expect(splitCustomerName('Adama')).toEqual({
            firstName: 'Adama',
            lastName: 'Client'
        })

        expect(buildFallbackCustomerEmail('', '+225 07 07 07 07 00'))
            .toBe('wa-2250707070700@wazzapai.com')
    })

    test('detects v2 webhook payload shape', () => {
        const { isCinetPayV2WebhookPayload } = require('../../../src/lib/payments/cinetpay-v2')

        expect(isCinetPayV2WebhookPayload({
            notify_token: 'notify_123',
            merchant_transaction_id: 'BKG_123',
            transaction_id: 'provider_456'
        })).toBe(true)

        expect(isCinetPayV2WebhookPayload({
            cpm_trans_id: 'ORD_123'
        })).toBe(false)
    })
})

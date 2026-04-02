const mockNotifyAdmins = jest.fn(() => Promise.resolve())

jest.mock('@/lib/api-utils', () => ({
    isAdminRole: jest.fn(() => true)
}))

jest.mock('@/lib/notifications/admin-notify', () => ({
    notifyAdmins: (...args) => mockNotifyAdmins(...args)
}))

jest.mock('@/lib/conversations/resume-agent-conversations', () => ({
    resumeActiveConversationsForAgents: jest.fn(() => Promise.resolve())
}))

jest.mock('@/lib/whatsapp/reactivation', () => ({
    collectReconnectableAgentIds: jest.fn(() => [])
}))

jest.mock('@/lib/payments/provider', () => ({
    checkHostedPaymentStatus: jest.fn(),
    normalizePaymentProvider: jest.fn((value) => String(value || '').trim().toLowerCase() === 'paystack' ? 'paystack' : 'cinetpay')
}))

jest.mock('@/lib/test-account', () => ({
    markUserAsQualified: jest.fn(() => Promise.resolve())
}))

describe('payment finalization', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('persists paystack payment channel information when a payment completes', async () => {
        const { finalizePaymentRecord } = require('@/lib/payments/finalization')
        const paymentUpdates = []

        const adminSupabase = {
            rpc: jest.fn(async () => ({ data: 900, error: null })),
            from: jest.fn((table) => {
                if (table === 'payments') {
                    return {
                        update: jest.fn((payload) => ({
                            eq: jest.fn(async () => {
                                paymentUpdates.push(payload)
                                return { error: null }
                            })
                        }))
                    }
                }

                throw new Error(`Unexpected table access: ${table}`)
            })
        }

        const payment = {
            id: 'payment_1',
            user_id: 'user_1',
            status: 'processing',
            payment_type: 'credits',
            payment_provider: 'paystack',
            amount_fcfa: 100,
            credits_purchased: 200,
            provider_response: null
        }

        const finalized = await finalizePaymentRecord(
            adminSupabase,
            payment,
            'ACCEPTED',
            {
                verification: {
                    data: {
                        channel: 'mobile_money',
                        authorization: {
                            bank: 'Orange Money'
                        }
                    }
                }
            }
        )

        expect(finalized.ok).toBe(true)
        expect(paymentUpdates).toHaveLength(1)
        expect(paymentUpdates[0]).toEqual(expect.objectContaining({
            status: 'completed',
            payment_channel: 'mobile_money',
            payment_channel_detail: 'Orange Money'
        }))
    })
})

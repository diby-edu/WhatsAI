const mockCheckPaymentStatus = jest.fn()
const mockInitializePayment = jest.fn()
const mockCheckPaymentStatusV2Runtime = jest.fn()
const mockInitializePaymentV2 = jest.fn()
const mockShouldUseCinetPayV2ForAgent = jest.fn(() => false)
const mockInitializePaystackPayment = jest.fn()
const mockResolvePaystackCustomerEmail = jest.fn((_email, transactionId) => `${transactionId}@example.com`)
const mockVerifyPaystackTransaction = jest.fn()

jest.mock('@/lib/payments/cinetpay', () => ({
    checkPaymentStatus: (...args) => mockCheckPaymentStatus(...args),
    initializePayment: (...args) => mockInitializePayment(...args),
    checkPaymentStatusV2Runtime: (...args) => mockCheckPaymentStatusV2Runtime(...args),
}))

jest.mock('@/lib/payments/cinetpay-v2', () => ({
    initializePaymentV2: (...args) => mockInitializePaymentV2(...args),
    shouldUseCinetPayV2ForAgent: (...args) => mockShouldUseCinetPayV2ForAgent(...args),
}))

jest.mock('@/lib/payments/paystack', () => ({
    initializePaystackPayment: (...args) => mockInitializePaystackPayment(...args),
    resolvePaystackCustomerEmail: (...args) => mockResolvePaystackCustomerEmail(...args),
    verifyPaystackTransaction: (...args) => mockVerifyPaystackTransaction(...args),
}))

describe('payment provider helpers', () => {
    const previousEnv = { ...process.env }

    beforeEach(() => {
        jest.clearAllMocks()
        process.env = { ...previousEnv }
    })

    afterAll(() => {
        process.env = previousEnv
    })

    test('normalizes only supported providers and throws on invalid explicit values', () => {
        const {
            normalizePaymentProvider,
            parsePaymentProvider,
        } = require('@/lib/payments/provider')

        expect(parsePaymentProvider('paystack')).toBe('paystack')
        expect(parsePaymentProvider('cinetpay')).toBe('cinetpay')
        expect(parsePaymentProvider('unknown')).toBeNull()
        expect(normalizePaymentProvider('')).toBe('cinetpay')
        expect(normalizePaymentProvider('paystack')).toBe('paystack')
        expect(() => normalizePaymentProvider('stripe')).toThrow(/unsupported payment provider/i)
    })

    test('reports provider readiness from runtime env and blocks unsafe providers', () => {
        const {
            ensurePaymentProviderReady,
            getPaymentProviderReadiness,
        } = require('@/lib/payments/provider')

        delete process.env.PAYSTACK_SECRET_KEY
        delete process.env.NEXT_PUBLIC_APP_URL

        expect(getPaymentProviderReadiness('paystack')).toEqual(expect.objectContaining({
            provider: 'paystack',
            ready: false,
            missingKeys: ['PAYSTACK_SECRET_KEY', 'NEXT_PUBLIC_APP_URL'],
        }))
        expect(() => ensurePaymentProviderReady('paystack')).toThrow(/paystack is not ready/i)

        process.env.PAYSTACK_SECRET_KEY = 'sk_live_demo'
        process.env.NEXT_PUBLIC_APP_URL = 'https://wazzapai.com'

        expect(getPaymentProviderReadiness('paystack')).toEqual(expect.objectContaining({
            provider: 'paystack',
            ready: true,
            missingKeys: [],
        }))
    })

    test('loads the default provider strictly from admin settings', async () => {
        const { getDefaultPaymentProvider } = require('@/lib/payments/provider')

        const adminSupabase = {
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    in: jest.fn(async () => ({
                        data: [{ key: 'defaultPaymentProvider', value: 'paystack' }],
                        error: null,
                    })),
                })),
            })),
        }

        await expect(getDefaultPaymentProvider(adminSupabase)).resolves.toBe('paystack')
    })

    test('throws when loading the default provider fails', async () => {
        const { getDefaultPaymentProvider } = require('@/lib/payments/provider')

        const adminSupabase = {
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    in: jest.fn(async () => ({
                        data: null,
                        error: { message: 'db unavailable' },
                    })),
                })),
            })),
        }

        await expect(getDefaultPaymentProvider(adminSupabase)).rejects.toThrow(/unable to load default payment provider/i)
    })

    test('inspects existing hosted payments before deciding reuse vs regeneration', async () => {
        const { inspectExistingHostedPayment } = require('@/lib/payments/provider')

        mockVerifyPaystackTransaction.mockResolvedValueOnce({
            success: true,
            status: 'PENDING',
            transactionId: 'tx_1',
        })
        await expect(inspectExistingHostedPayment('paystack', 'tx_1')).resolves.toEqual({
            provider: 'paystack',
            action: 'reuse',
            providerStatus: 'PENDING',
            error: null,
        })

        mockVerifyPaystackTransaction.mockResolvedValueOnce({
            success: true,
            status: 'ACCEPTED',
            transactionId: 'tx_2',
        })
        await expect(inspectExistingHostedPayment('paystack', 'tx_2')).resolves.toEqual({
            provider: 'paystack',
            action: 'accepted',
            providerStatus: 'ACCEPTED',
            error: null,
        })

        mockVerifyPaystackTransaction.mockResolvedValueOnce({
            success: false,
            status: 'UNKNOWN',
            transactionId: 'tx_3',
            message: 'network',
        })
        await expect(inspectExistingHostedPayment('paystack', 'tx_3')).resolves.toEqual({
            provider: 'paystack',
            action: 'regenerate',
            providerStatus: 'UNKNOWN',
            error: 'network',
        })
    })
})

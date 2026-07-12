// Polyfills Web API (Request/Response/...) fournis globalement par jest.setup.ts (E#8)
const { NextRequest } = require('next/server')

const mockCreateApiClient = jest.fn()
const mockGetAuthUser = jest.fn()
const mockCreateAdminClient = jest.fn()
const mockCanAccessPayment = jest.fn()
const mockFindPaymentByIdentifiers = jest.fn()
const mockFinalizePaymentByTransaction = jest.fn()
const mockGetUserRole = jest.fn()
const mockIsAdminRole = jest.fn()
const mockCheckHostedPaymentStatus = jest.fn()
const mockNormalizePaymentProvider = jest.fn((value) => value || 'cinetpay')
const mockFinalizeHostedCheckoutTransaction = jest.fn()

jest.mock('@/lib/payments/provider', () => ({
    checkHostedPaymentStatus: (...args) => mockCheckHostedPaymentStatus(...args),
    normalizePaymentProvider: (...args) => mockNormalizePaymentProvider(...args)
}))

jest.mock('@/lib/payments/hosted-checkout-finalization', () => ({
    finalizeHostedCheckoutTransaction: (...args) => mockFinalizeHostedCheckoutTransaction(...args)
}))

jest.mock('@/lib/api-utils', () => ({
    createApiClient: (...args) => mockCreateApiClient(...args),
    createAdminClient: (...args) => mockCreateAdminClient(...args),
    getAuthUser: (...args) => mockGetAuthUser(...args),
    isAdminRole: (...args) => mockIsAdminRole(...args)
}))

jest.mock('@/lib/payments/finalization', () => ({
    canAccessPayment: (...args) => mockCanAccessPayment(...args),
    findPaymentByIdentifiers: (...args) => mockFindPaymentByIdentifiers(...args),
    finalizePaymentByTransaction: (...args) => mockFinalizePaymentByTransaction(...args),
    getUserRole: (...args) => mockGetUserRole(...args)
}))

const { GET } = require('@/app/api/payments/cinetpay/status/route')

describe('GET /api/payments/cinetpay/status', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockFinalizeHostedCheckoutTransaction.mockResolvedValue({ ok: true, state: 'finalized' })
    })

    test('allows public verification for booking transactions without requiring auth', async () => {
        mockCreateAdminClient.mockReturnValue({
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(async () => ({ data: null })),
                        maybeSingle: jest.fn(async () => ({ data: null, error: null }))
                    }))
                }))
            }))
        })
        mockCheckHostedPaymentStatus.mockResolvedValue({
            success: true,
            status: 'ACCEPTED',
            amount: 5000,
            message: 'MOMO'
        })

        const request = new NextRequest('http://localhost/api/payments/cinetpay/status?transaction_id=BKG_demo_123')
        const response = await GET(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: true,
            status: 'ACCEPTED',
            transaction_id: 'BKG_demo_123',
            amount: 5000,
            finalization_state: 'finalized',
        }))
        expect(mockCheckHostedPaymentStatus).toHaveBeenCalledWith('cinetpay', 'BKG_demo_123', { providerVersion: 'v1' })
        expect(mockFinalizeHostedCheckoutTransaction).toHaveBeenCalledWith(
            expect.any(Object),
            'BKG_demo_123',
            expect.objectContaining({
                provider: 'cinetpay',
                amount: 5000,
                providerPayload: expect.anything(),
            })
        )
        expect(mockCreateApiClient).not.toHaveBeenCalled()
        expect(mockGetAuthUser).not.toHaveBeenCalled()
    })

    test('does not finalize public checkout when provider still reports pending', async () => {
        mockCreateAdminClient.mockReturnValue({
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(async () => ({ data: { payment_provider: 'paystack', payment_provider_version: 'v1' } })),
                        maybeSingle: jest.fn(async () => ({ data: { payment_provider: 'paystack', payment_provider_version: 'v1' }, error: null }))
                    }))
                }))
            }))
        })
        mockCheckHostedPaymentStatus.mockResolvedValue({
            success: true,
            status: 'PENDING',
            amount: 5000,
            message: 'Awaiting confirmation'
        })

        const request = new NextRequest('http://localhost/api/payments/cinetpay/status?transaction_id=ORD_demo_123')
        const response = await GET(request)
        const json = await response.json()

        expect(response.status).toBe(200)
        expect(json).toEqual(expect.objectContaining({
            success: false,
            status: 'PENDING',
            finalization_state: null,
        }))
        expect(mockFinalizeHostedCheckoutTransaction).not.toHaveBeenCalled()
    })
})

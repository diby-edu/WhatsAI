const { TextDecoder, TextEncoder } = require('util')
const { ReadableStream, WritableStream, TransformStream } = require('stream/web')
const { Blob, File } = require('buffer')
const { MessageChannel, MessagePort } = require('worker_threads')

global.TextDecoder = TextDecoder
global.TextEncoder = TextEncoder
global.ReadableStream = ReadableStream
global.WritableStream = WritableStream
global.TransformStream = TransformStream
global.Blob = Blob
global.File = File
global.MessageChannel = MessageChannel
global.MessagePort = MessagePort

const { Request, Response, Headers, FormData } = require('undici')

global.Request = Request
global.Response = Response
global.Headers = Headers
global.FormData = FormData

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

jest.mock('@/lib/payments/provider', () => ({
    checkHostedPaymentStatus: (...args) => mockCheckHostedPaymentStatus(...args),
    normalizePaymentProvider: (...args) => mockNormalizePaymentProvider(...args)
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
    })

    test('allows public verification for booking transactions without requiring auth', async () => {
        mockCreateAdminClient.mockReturnValue({
            from: jest.fn(() => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(async () => ({ data: null }))
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
            amount: 5000
        }))
        expect(mockCheckHostedPaymentStatus).toHaveBeenCalledWith('cinetpay', 'BKG_demo_123', { providerVersion: 'v1' })
        expect(mockCreateApiClient).not.toHaveBeenCalled()
        expect(mockGetAuthUser).not.toHaveBeenCalled()
    })
})

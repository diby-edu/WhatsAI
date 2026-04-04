jest.mock('../../../src/lib/notifications/notify', () => ({
    notify: jest.fn(async () => null),
}))

const mockGetDefaultPaymentProvider = jest.fn()
const mockInitializeHostedPayment = jest.fn()
const mockInspectExistingHostedPayment = jest.fn()
const mockNormalizePaymentProvider = jest.fn((value) => value || 'cinetpay')

jest.mock('@/lib/payments/provider', () => ({
    getDefaultPaymentProvider: (...args) => mockGetDefaultPaymentProvider(...args),
    initializeHostedPayment: (...args) => mockInitializeHostedPayment(...args),
    inspectExistingHostedPayment: (...args) => mockInspectExistingHostedPayment(...args),
    normalizePaymentProvider: (...args) => mockNormalizePaymentProvider(...args),
}))

const {
    updateBookingStateFromUserMessage,
    mergeBookingStateIntoToolArgs,
} = require('../../../src/lib/whatsapp/services/booking-state.service')
const { handleCreateBooking } = require('../../../src/lib/whatsapp/ai/tools/tool-bookings')

describe('Hotel booking flow', () => {
    const hotelService = {
        id: 'service-hotel-1',
        name: 'Hotel Lagoon',
        product_type: 'service',
        service_subtype: 'hotel',
        price_fcfa: 50000,
        variants: [],
    }

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.NEXT_PUBLIC_APP_URL = 'https://wazzapai.com'
        mockGetDefaultPaymentProvider.mockResolvedValue('paystack')
        mockInspectExistingHostedPayment.mockResolvedValue({
            action: 'reuse',
            provider: 'paystack',
            providerStatus: 'PENDING',
            error: null,
        })
        mockInitializeHostedPayment.mockResolvedValue({
            success: true,
            paymentUrl: 'https://checkout.paystack.com/service-booking',
            providerVersion: 'v1',
            providerTransactionId: 'BKG_paystack_ref',
            providerNotifyToken: null,
        })
    })

    test('captures hotel payment choice in booking state and keeps the recap total by nights', () => {
        const previousState = {
            stage: 'collecting',
            current_booking: {
                service_id: hotelService.id,
                service_name: hotelService.name,
                service_subtype: 'hotel',
                selected_variants: {},
                selected_variants_by_id: {},
                selected_supplements: {},
                selected_supplements_by_id: {},
                skipped_optional_variant_ids: [],
                preferred_date: '2026-04-10',
                end_date: '2026-04-12',
                preferred_time: null,
                party_size: 2,
                customer_name: 'Awa Konan',
                customer_phone: '+2250701020304',
                payment_method: null,
                notes: 'Lit bebe',
                note_declined: false,
            },
            awaiting_field: {
                type: 'payment_method',
                label: 'mode de paiement',
                prompt: 'Souhaitez-vous payer en ligne ou sur place ?'
            },
        }

        const result = updateBookingStateFromUserMessage(previousState, 'Je reglerai sur place', [hotelService])
        const mergedArgs = mergeBookingStateIntoToolArgs('create_booking', {}, result.state)

        expect(result.state.current_booking.payment_method).toBe('onsite')
        expect(mergedArgs.payment_method).toBe('onsite')
        expect(result.directReply).toMatch(/Paiement : paiement manuel sur place/i)
        expect(result.directReply).toMatch(/100\s?000 FCFA/i)
        expect(result.directReply).toMatch(/2 nuit/i)
    })

    test('creates a stay booking with payment method and multiplies the nightly price by the number of nights', async () => {
        const insertMock = jest.fn(() => ({
            select: () => ({
                single: async () => ({
                    data: { id: 'booking-123' },
                    error: null,
                })
            })
        }))

        const supabase = {
            from: jest.fn((table) => {
                if (table === 'agents') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: { user_id: 'user-1', escalation_phone: '+2250102030405' },
                                    error: null,
                                })
                            })
                        })
                    }
                }

                if (table === 'bookings') {
                    return {
                        insert: insertMock,
                    }
                }

                throw new Error(`Unexpected table: ${table}`)
            })
        }

        const rawResult = await handleCreateBooking({
            booking_type: 'stay',
            service_name: 'Hotel Lagoon',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            preferred_date: '2026-04-10',
            end_date: '2026-04-12',
            party_size: 2,
            payment_method: 'sur place',
            notes: 'Lit bebe',
        }, 'agent-1', [hotelService], 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.booking_type).toBe('stay')
        expect(result.payment_method).toBe('onsite')
        expect(result.nights).toBe(2)
        expect(result.price_fcfa).toBe(100000)
        expect(result.message).toMatch(/2 nuit/i)
        expect(result.message).toMatch(/Paiement : paiement manuel sur place/i)
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            booking_type: 'stay',
            payment_method: 'onsite',
            price_fcfa: 100000,
            end_date: '2026-04-12',
            party_size: 2,
        }))
    })

    test('rejects a hotel booking when the end date is missing', async () => {
        const supabase = {
            from: jest.fn((table) => {
                if (table === 'agents') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: { user_id: 'user-1', escalation_phone: null },
                                    error: null,
                                })
                            })
                        })
                    }
                }

                if (table === 'bookings') {
                    return {
                        insert: jest.fn(),
                    }
                }

                throw new Error(`Unexpected table: ${table}`)
            })
        }

        const rawResult = await handleCreateBooking({
            booking_type: 'stay',
            service_name: 'Hotel Lagoon',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            preferred_date: '2026-04-10',
            party_size: 2,
            payment_method: 'online',
        }, 'agent-1', [hotelService], 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/DATE DE FIN MANQUANTE/i)
    })

    test('creates an online stay booking with a hosted payment link and full payment metadata', async () => {
        const updates = []
        const insertMock = jest.fn(() => ({
            select: () => ({
                single: async () => ({
                    data: { id: 'booking-123', transaction_id: null, provider_payment_url: null, payment_provider: null, payment_provider_version: null },
                    error: null,
                })
            })
        }))

        const supabase = {
            from: jest.fn((table) => {
                if (table === 'agents') {
                    return {
                        select: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: { user_id: 'user-1', escalation_phone: '+2250102030405' },
                                    error: null,
                                })
                            })
                        })
                    }
                }

                if (table === 'bookings') {
                    return {
                        insert: insertMock,
                        select: () => ({
                            eq: () => ({
                                single: async () => ({
                                    data: {
                                        id: 'booking-123',
                                        transaction_id: null,
                                        provider_payment_url: null,
                                        payment_provider: null,
                                        payment_provider_version: null,
                                    },
                                    error: null,
                                })
                            })
                        }),
                        update: (payload) => ({
                            eq: async (_column, value) => {
                                updates.push({ value, payload })
                                return { error: null }
                            }
                        }),
                    }
                }

                throw new Error(`Unexpected table: ${table}`)
            })
        }

        const rawResult = await handleCreateBooking({
            booking_type: 'stay',
            service_name: 'Hotel Lagoon',
            customer_name: 'Awa Konan',
            customer_phone: '+2250701020304',
            preferred_date: '2026-04-10',
            end_date: '2026-04-12',
            party_size: 2,
            payment_method: 'online',
            notes: 'Lit bebe',
        }, 'agent-1', [hotelService], 'conversation-1', supabase)

        const result = JSON.parse(rawResult)

        expect(result.success).toBe(true)
        expect(result.payment_method).toBe('online')
        expect(result.payment_provider).toBe('paystack')
        expect(result.payment_link).toBe('https://checkout.paystack.com/service-booking')
        expect(result.message).toMatch(/confirmee apres reception du paiement/i)
        expect(result.message).toMatch(/Lien de paiement : https:\/\/checkout\.paystack\.com\/service-booking/i)
        expect(insertMock).toHaveBeenCalledWith(expect.objectContaining({
            payment_method: 'online',
            status: 'pending',
            deposit_required: true,
            deposit_percentage: 100,
            deposit_amount_fcfa: 100000,
            deposit_status: 'pending',
            price_fcfa: 100000,
        }))
        expect(mockInitializeHostedPayment).toHaveBeenCalledWith(expect.objectContaining({
            provider: 'paystack',
            amountFcfa: 100000,
            description: 'Paiement reservation #booking-',
            notifyUrl: 'https://wazzapai.com/api/payments/paystack/webhook',
            metadata: {
                booking_id: 'booking-123',
                type: 'booking_payment',
            },
        }))
        expect(updates).toHaveLength(1)
        expect(updates[0].payload).toEqual(expect.objectContaining({
            payment_provider: 'paystack',
            provider_payment_url: 'https://checkout.paystack.com/service-booking',
            provider_transaction_id: 'BKG_paystack_ref',
            payment_provider_version: 'v1',
        }))
    })
})

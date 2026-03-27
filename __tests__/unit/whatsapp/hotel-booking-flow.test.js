jest.mock('../../../src/lib/notifications/notify', () => ({
    notify: jest.fn(async () => null),
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
        expect(result.directReply).toMatch(/Paiement : sur place/i)
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
        expect(result.message).toMatch(/Paiement : sur place/i)
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
})

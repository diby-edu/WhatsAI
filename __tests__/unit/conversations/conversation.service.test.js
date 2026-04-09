const { ConversationService } = require('../../../src/lib/whatsapp/services/conversation.service')

function createSupabaseMock(initialConversation) {
    const updates = []

    return {
        updates,
        supabase: {
            from: jest.fn((table) => ({
                select: jest.fn(() => ({
                    eq: jest.fn(() => ({
                        single: jest.fn(async () => {
                            if (table === 'conversations') {
                                return { data: initialConversation, error: null }
                            }
                            return { data: null, error: null }
                        }),
                    })),
                })),
                update: jest.fn((payload) => ({
                    eq: jest.fn(() => ({
                        select: jest.fn(() => ({
                            single: jest.fn(async () => {
                                const updated = {
                                    ...initialConversation,
                                    ...payload,
                                }
                                updates.push(updated)
                                return { data: updated, error: null }
                            }),
                        })),
                    })),
                })),
            })),
        },
    }
}

describe('ConversationService cycle management', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('closeCompletedCycle closes the conversation and clears transactional metadata', async () => {
        const { supabase, updates } = createSupabaseMock({
            id: 'conv_1',
            status: 'active',
            bot_paused: false,
            metadata: {
                cart: { stage: 'checkout' },
                checkout: { stage: 'customer_recap' },
                booking: { current: true },
                restaurant: { section: 'plats' },
                external_context: { preserved: true },
            },
        })

        const updated = await ConversationService.closeCompletedCycle(
            supabase,
            'conv_1',
            'digital_delivery_completed'
        )

        expect(updated.status).toBe('closed')
        expect(updated.bot_paused).toBe(false)
        expect(updated.metadata.cart).toBeNull()
        expect(updated.metadata.checkout).toBeNull()
        expect(updated.metadata.booking).toBeNull()
        expect(updated.metadata.restaurant).toBeNull()
        expect(updated.metadata.external_context).toEqual({ preserved: true })
        expect(updated.metadata.session_anchor_at).toBeNull()
        expect(updated.metadata.last_cycle_reason).toBe('digital_delivery_completed')
        expect(updates).toHaveLength(1)
    })

    test('reopenClosedCycle reactivates the conversation and starts a fresh session window', async () => {
        const { supabase, updates } = createSupabaseMock({
            id: 'conv_1',
            status: 'closed',
            bot_paused: false,
            metadata: {
                cart: { stale: true },
                checkout: { stale: true },
                last_cycle_closed_at: '2026-04-09T17:00:00.000Z',
            },
        })

        const updated = await ConversationService.reopenClosedCycle(supabase, 'conv_1')

        expect(updated.status).toBe('active')
        expect(updated.bot_paused).toBe(false)
        expect(updated.metadata.cart).toBeNull()
        expect(updated.metadata.checkout).toBeNull()
        expect(typeof updated.metadata.session_anchor_at).toBe('string')
        expect(updated.metadata.last_cycle_closed_at).toBe('2026-04-09T17:00:00.000Z')
        expect(updates).toHaveLength(1)
    })
})

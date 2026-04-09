const { ConversationService } = require('../../../src/lib/whatsapp/services/conversation.service')

jest.mock('../../../src/lib/notifications/admin-notify', () => ({
    notifyAdmins: jest.fn(() => Promise.resolve()),
}))

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

function createGetOrCreateSupabaseMock({ existingByField = {}, initialConversation = null } = {}) {
    const updates = []
    const createdRows = []
    let currentConversation = initialConversation

    const conversationsTable = {
        select: jest.fn(() => {
            const filters = {}
            return {
                eq(field, value) {
                    filters[field] = value
                    return this
                },
                maybeSingle: jest.fn(async () => {
                    const lookupKey = `${filters.agent_id || ''}:${filters.contact_phone || filters.contact_jid || ''}`
                    const data = existingByField[lookupKey] || null
                    return { data, error: null }
                }),
                single: jest.fn(async () => {
                    return { data: currentConversation, error: null }
                }),
            }
        }),
        update: jest.fn((payload) => ({
            eq: jest.fn(() => ({
                select: jest.fn(() => ({
                    single: jest.fn(async () => {
                        currentConversation = {
                            ...(currentConversation || {}),
                            ...payload,
                        }
                        updates.push(currentConversation)
                        return { data: currentConversation, error: null }
                    }),
                })),
            })),
        })),
        insert: jest.fn((payload) => ({
            select: jest.fn(() => ({
                single: jest.fn(async () => {
                    const row = {
                        id: 'conv_new',
                        ...payload,
                    }
                    createdRows.push(row)
                    currentConversation = row
                    return { data: row, error: null }
                }),
            })),
        })),
    }

    const agentsTable = {
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                single: jest.fn(async () => ({ data: { name: 'Agent Test' }, error: null })),
            })),
        })),
    }

    return {
        updates,
        createdRows,
        supabase: {
            from: jest.fn((table) => {
                if (table === 'conversations') return conversationsTable
                if (table === 'agents') return agentsTable
                throw new Error(`Unexpected table access in test: ${table}`)
            }),
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

    test('getOrCreate upgrades legacy raw JID conversations to canonical phone + jid storage', async () => {
        const existing = {
            id: 'conv_legacy',
            agent_id: 'agent_1',
            user_id: 'user_1',
            contact_phone: '22547094746@s.whatsapp.net',
            contact_jid: null,
            status: 'active',
            metadata: {},
        }
        const { supabase, updates, createdRows } = createGetOrCreateSupabaseMock({
            existingByField: {
                'agent_1:22547094746@s.whatsapp.net': existing,
            },
            initialConversation: existing,
        })

        const conversation = await ConversationService.getOrCreate(
            supabase,
            'agent_1',
            'user_1',
            '22547094746@s.whatsapp.net',
            { wa_name: 'Kono' }
        )

        expect(conversation.id).toBe('conv_legacy')
        expect(createdRows).toHaveLength(0)
        expect(updates).toHaveLength(1)
        expect(updates[0].contact_phone).toBe('+22547094746')
        expect(updates[0].contact_jid).toBe('22547094746@s.whatsapp.net')
        expect(updates[0].metadata).toEqual({ wa_name: 'Kono' })
    })

    test('getOrCreate reuses canonical phone conversations and refreshes the current jid', async () => {
        const existing = {
            id: 'conv_phone',
            agent_id: 'agent_1',
            user_id: 'user_1',
            contact_phone: '+22547094746',
            contact_jid: null,
            status: 'closed',
            metadata: { preserved: true },
        }
        const { supabase, updates, createdRows } = createGetOrCreateSupabaseMock({
            existingByField: {
                'agent_1:+22547094746': existing,
            },
            initialConversation: existing,
        })

        const conversation = await ConversationService.getOrCreate(
            supabase,
            'agent_1',
            'user_1',
            '22547094746@s.whatsapp.net',
            { wa_name: 'Kono' }
        )

        expect(conversation.id).toBe('conv_phone')
        expect(createdRows).toHaveLength(0)
        expect(updates).toHaveLength(1)
        expect(updates[0].contact_phone).toBe('+22547094746')
        expect(updates[0].contact_jid).toBe('22547094746@s.whatsapp.net')
        expect(updates[0].metadata).toEqual({ preserved: true, wa_name: 'Kono' })
    })
})

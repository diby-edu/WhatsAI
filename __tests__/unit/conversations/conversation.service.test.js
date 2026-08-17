const { ConversationService, findConversationByField } = require('../../../src/lib/whatsapp/services/conversation.service')

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

function createGetOrCreateSupabaseMock({ existingByField = {}, initialConversation = null, insertError = null, racedConversation = null } = {}) {
    const updates = []
    const createdRows = []
    let currentConversation = initialConversation
    let insertAttempted = false

    const conversationsTable = {
        select: jest.fn(() => {
            const filters = {}
            const chain = {
                eq(field, value) {
                    filters[field] = value
                    return chain
                },
                // findConversationByField trie par created_at — le mock l'ignore et renvoie
                // les lignes telles que fournies par le test (déjà dans l'ordre voulu).
                order() {
                    return chain
                },
                limit: jest.fn(async () => {
                    if (insertAttempted && racedConversation) {
                        return { data: [racedConversation], error: null }
                    }
                    const lookupKey = `${filters.agent_id || ''}:${filters.contact_phone || filters.contact_jid || ''}`
                    const found = existingByField[lookupKey] || null
                    const rows = Array.isArray(found) ? found : (found ? [found] : [])
                    return { data: rows.slice(0, 1), error: null }
                }),
                single: jest.fn(async () => {
                    return { data: currentConversation, error: null }
                }),
            }
            return chain
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
                    insertAttempted = true
                    if (insertError) {
                        return { data: null, error: insertError }
                    }
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

    test('getOrCreate recovers from a concurrent insert conflict by re-reading the winning row', async () => {
        // Simule 2 messages quasi simultanés du même contact : le lookup initial ne
        // trouve rien, l'INSERT échoue sur la contrainte unique (une autre requête a
        // gagné la course), et getOrCreate doit relire cette ligne au lieu de planter.
        const racedConversation = {
            id: 'conv_raced',
            agent_id: 'agent_1',
            user_id: 'user_1',
            contact_phone: '+22547094746',
            contact_jid: '22547094746@s.whatsapp.net',
            status: 'active',
            metadata: {},
        }
        const { supabase, createdRows } = createGetOrCreateSupabaseMock({
            existingByField: {},
            insertError: { code: '23505', message: 'duplicate key value violates unique constraint' },
            racedConversation,
        })

        const conversation = await ConversationService.getOrCreate(
            supabase,
            'agent_1',
            'user_1',
            '22547094746@s.whatsapp.net',
            { wa_name: 'Kono' }
        )

        expect(conversation.id).toBe('conv_raced')
        expect(createdRows).toHaveLength(0)
    })

    /**
     * Régression réelle (17/08/2026) : deux JID @lid distincts normalisés par erreur vers le
     * même contact_phone ont produit 2 lignes `conversations` pour ce champ. .maybeSingle()
     * plantait dessus (PGRST116, "2 rows"), et CHAQUE message suivant de ce contact retombait
     * sur la même erreur — silence total, pas seulement une mauvaise ligne choisie.
     *
     * findConversationByField ne doit plus jamais planter sur une collision : elle choisit la
     * plus ancienne ligne plutôt que d'échouer.
     */
    describe('findConversationByField — résilience aux collisions', () => {
        test('deux lignes matchant le même champ : la plus ancienne est retenue, pas d\'erreur', async () => {
            const ancienne = { id: 'conv_ancien', created_at: '2026-08-17T10:00:00.000Z' }
            const recente = { id: 'conv_recent', created_at: '2026-08-17T10:00:00.140Z' }
            const supabase = {
                from: jest.fn(() => ({
                    select: jest.fn(() => ({
                        eq: jest.fn(function () { return this }),
                        order: jest.fn(function () { return this }),
                        // Le vrai client Supabase trierait par created_at ; le mock renvoie
                        // directement les 2 lignes de collision, plus ancienne en premier —
                        // c'est justement l'ordre que .limit(1) doit préserver.
                        limit: jest.fn(async () => ({ data: [ancienne, recente], error: null })),
                    })),
                })),
            }

            const result = await findConversationByField(supabase, 'agent_1', 'contact_phone', '+22500000000')
            expect(result.id).toBe('conv_ancien')
        })

        test('aucune ligne : retourne null sans planter', async () => {
            const supabase = {
                from: jest.fn(() => ({
                    select: jest.fn(() => ({
                        eq: jest.fn(function () { return this }),
                        order: jest.fn(function () { return this }),
                        limit: jest.fn(async () => ({ data: [], error: null })),
                    })),
                })),
            }
            expect(await findConversationByField(supabase, 'agent_1', 'contact_phone', '+22500000000')).toBeNull()
        })

        test('une vraie erreur Supabase (pas une collision) reste propagée', async () => {
            const supabase = {
                from: jest.fn(() => ({
                    select: jest.fn(() => ({
                        eq: jest.fn(function () { return this }),
                        order: jest.fn(function () { return this }),
                        limit: jest.fn(async () => ({ data: null, error: { message: 'connection refused' } })),
                    })),
                })),
            }
            await expect(findConversationByField(supabase, 'agent_1', 'contact_phone', '+22500000000'))
                .rejects.toEqual({ message: 'connection refused' })
        })
    })

    test('getOrCreate ne plante plus quand le lookup initial rencontre une collision', async () => {
        // Même contexte que le bug réel : 2 lignes déjà en base pour le même champ de
        // recherche. getOrCreate doit continuer à répondre (pas de CONVERSATION_GET_FAILED),
        // en se rattachant à la plus ancienne plutôt que d'échouer.
        const ancienne = {
            id: 'conv_ancien', agent_id: 'agent_1', user_id: 'user_1',
            contact_phone: '+22500000000', contact_jid: null, status: 'active', metadata: {},
        }
        const recente = {
            id: 'conv_recent', agent_id: 'agent_1', user_id: 'user_1',
            contact_phone: '+22500000000', contact_jid: null, status: 'active', metadata: {},
        }
        const { supabase, createdRows } = createGetOrCreateSupabaseMock({
            existingByField: { 'agent_1:+22500000000': [ancienne, recente] },
            initialConversation: ancienne,
        })

        const conversation = await ConversationService.getOrCreate(
            supabase, 'agent_1', 'user_1', '+22500000000', {}
        )

        expect(conversation.id).toBe('conv_ancien')
        expect(createdRows).toHaveLength(0)
    })
})

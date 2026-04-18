const {
    allRelatedCountsAreZero,
    buildSystemDeletionAuditEntry,
    captureSystemDeletionSnapshot,
} = require('../../../src/lib/notifications/system-deletion-audit')

function createSupabaseMock({ agentIds = [], counts = {} } = {}) {
    return {
        from: jest.fn((table) => ({
            select: jest.fn((columns, options = {}) => {
                if (table === 'agents' && columns === 'id' && !options.head) {
                    return {
                        eq: jest.fn(async () => ({
                            data: agentIds.map((id) => ({ id })),
                            error: null,
                        })),
                    }
                }

                return {
                    eq: jest.fn(async () => ({
                        count: counts[table] || 0,
                        error: null,
                    })),
                    in: jest.fn(async () => ({
                        count: counts[`${table}:in`] || counts[table] || 0,
                        error: null,
                    })),
                }
            }),
        })),
    }
}

describe('system deletion audit helpers', () => {
    test('detects when all post-delete related counts are zero', () => {
        expect(allRelatedCountsAreZero({
            agents: 0,
            whatsapp_sessions: 0,
            conversations: 0,
            messages: 0,
            knowledge_base: 0,
            products: 0,
            subscriptions: 0,
            payments: 0,
            orders: 0,
        })).toBe(true)

        expect(allRelatedCountsAreZero({
            agents: 0,
            orders: 1,
        })).toBe(false)
    })

    test('builds an audit row with cascade verification and lifecycle summary', () => {
        const entry = buildSystemDeletionAuditEntry({
            profile: {
                id: 'user-1',
                email: 'user@example.com',
                full_name: 'User One',
                plan: 'business',
                role: 'user',
                account_lifecycle_status: 'inactive',
                paid_until: '2026-03-01T00:00:00.000Z',
                grace_until: '2026-04-01T00:00:00.000Z',
            },
            reason: 'expired_paid_grace',
            result: 'deleted',
            liveState: {
                lifecycleAccess: {
                    bannerMode: 'paid_expired',
                    lifecycle: {
                        status: 'inactive',
                        shouldDeleteAfterGrace: true,
                    },
                },
            },
            beforeSnapshot: {
                capturedAt: '2026-04-18T10:00:00.000Z',
                relatedCounts: {
                    agents: 2,
                    whatsapp_sessions: 1,
                    conversations: 5,
                    messages: 12,
                    knowledge_base: 3,
                    products: 4,
                    subscriptions: 1,
                    payments: 2,
                    orders: 6,
                },
            },
            afterSnapshot: {
                capturedAt: '2026-04-18T10:00:10.000Z',
                relatedCounts: {
                    agents: 0,
                    whatsapp_sessions: 0,
                    conversations: 0,
                    messages: 0,
                    knowledge_base: 0,
                    products: 0,
                    subscriptions: 0,
                    payments: 0,
                    orders: 0,
                },
            },
            note: 'deleted_by_cron',
        })

        expect(entry.deletion_reason).toBe('expired_paid_grace')
        expect(entry.deletion_result).toBe('deleted')
        expect(entry.related_counts_before.orders).toBe(6)
        expect(entry.related_counts_after.messages).toBe(0)
        expect(entry.metadata.source).toBe('system_cron')
        expect(entry.metadata.cascade_cleanup_verified).toBe(true)
        expect(entry.metadata.live_state.lifecycleStatus).toBe('inactive')
    })

    test('captures related row counts before or after deletion', async () => {
        const supabase = createSupabaseMock({
            agentIds: ['agent-1', 'agent-2'],
            counts: {
                whatsapp_sessions: 1,
                conversations: 4,
                knowledge_base: 3,
                products: 2,
                subscriptions: 1,
                payments: 5,
                orders: 6,
                'messages:in': 11,
            },
        })

        const snapshot = await captureSystemDeletionSnapshot(supabase, 'user-1')

        expect(snapshot.relatedCounts).toEqual({
            agents: 2,
            whatsapp_sessions: 1,
            conversations: 4,
            messages: 11,
            knowledge_base: 3,
            products: 2,
            subscriptions: 1,
            payments: 5,
            orders: 6,
        })
    })
})

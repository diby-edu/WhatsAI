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

function createProfilesTable(profile, profileUpdates) {
    return {
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                single: jest.fn(async () => ({ data: profile, error: null })),
            })),
        })),
        update: jest.fn((payload) => ({
            eq: jest.fn(async () => {
                profileUpdates.push(payload)
                return { error: null }
            }),
        })),
    }
}

function createSubscriptionsTable(existingSub, subscriptionUpdates, subscriptionInserts) {
    return {
        select: jest.fn(() => {
            const chain = {
                eq: jest.fn(() => chain),
                gte: jest.fn(() => ({
                    maybeSingle: jest.fn(async () => ({ data: existingSub, error: null })),
                })),
            }
            return chain
        }),
        update: jest.fn((payload) => ({
            eq: jest.fn(async () => {
                subscriptionUpdates.push(payload)
                return { error: null }
            }),
        })),
        insert: jest.fn(async (payload) => {
            subscriptionInserts.push(payload)
            return { error: null }
        }),
    }
}

function createSubscriptionPlansTable(plan) {
    return {
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({ data: null, error: null })),
            })),
            ilike: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({ data: plan, error: null })),
            })),
        })),
    }
}

function createAgentsTable() {
    const emptyOrdered = {
        order: jest.fn(() => emptyOrdered),
    }

    return {
        select: jest.fn(() => ({
            eq: jest.fn(() => ({
                not: jest.fn(() => emptyOrdered),
            })),
        })),
        update: jest.fn(() => ({
            in: jest.fn(async () => ({ error: null })),
        })),
    }
}

function createPaymentsTable(paymentUpdates) {
    return {
        update: jest.fn((payload) => ({
            eq: jest.fn(async () => {
                paymentUpdates.push(payload)
                return { error: null }
            }),
        })),
    }
}

function createAdminSupabase({
    profile,
    plan = null,
    existingSub = null,
    rpcBalance = 900,
}) {
    const profileUpdates = []
    const subscriptionUpdates = []
    const subscriptionInserts = []
    const paymentUpdates = []

    const adminSupabase = {
        rpc: jest.fn(async () => ({ data: rpcBalance, error: null })),
        from: jest.fn((table) => {
            if (table === 'profiles') {
                return createProfilesTable(profile, profileUpdates)
            }

            if (table === 'subscription_plans') {
                return createSubscriptionPlansTable(plan)
            }

            if (table === 'subscriptions') {
                return createSubscriptionsTable(existingSub, subscriptionUpdates, subscriptionInserts)
            }

            if (table === 'agents') {
                return createAgentsTable()
            }

            if (table === 'payments') {
                return createPaymentsTable(paymentUpdates)
            }

            throw new Error(`Unexpected table access: ${table}`)
        }),
    }

    return {
        adminSupabase,
        profileUpdates,
        subscriptionUpdates,
        subscriptionInserts,
        paymentUpdates,
    }
}

describe('payment finalization', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetModules()
        jest.useRealTimers()
    })

    test('persists paystack payment channel information when a payment completes', async () => {
        const { finalizePaymentRecord } = require('@/lib/payments/finalization')
        const paymentUpdates = []

        const adminSupabase = {
            rpc: jest.fn(async () => ({ data: 900, error: null })),
            from: jest.fn((table) => {
                if (table === 'profiles') {
                    return createProfilesTable({ plan: 'free', credits_balance: 0 }, [])
                }

                if (table === 'agents') {
                    return createAgentsTable()
                }

                if (table === 'payments') {
                    return createPaymentsTable(paymentUpdates)
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

    test('extends the paid window from the current expiry for same-plan renewals', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-07-20T10:00:00.000Z'))
        const { finalizePaymentRecord } = require('@/lib/payments/finalization')

        const { adminSupabase, profileUpdates, subscriptionUpdates } = createAdminSupabase({
            profile: {
                plan: 'starter',
                credits_balance: 120,
                credits_expire_at: null,
                paid_until: '2026-08-14T00:00:00.000Z',
                grace_until: null,
            },
            plan: {
                name: 'Starter',
                credits_included: 500,
                price_fcfa: 6900,
                billing_cycle: 'monthly',
            },
            existingSub: {
                id: 'sub_1',
                current_period_end: '2026-08-14T00:00:00.000Z',
                billing_cycle: 'monthly',
            },
        })

        const payment = {
            id: 'payment_sub_same_plan',
            user_id: 'user_sub_same_plan',
            status: 'processing',
            payment_type: 'subscription',
            payment_provider: 'cinetpay',
            amount_fcfa: 6900,
            metadata: JSON.stringify({ type: 'subscription', plan_name: 'Starter' }),
            provider_response: null,
        }

        const finalized = await finalizePaymentRecord(adminSupabase, payment, 'ACCEPTED')

        expect(finalized.ok).toBe(true)
        expect(subscriptionUpdates).toHaveLength(1)
        expect(subscriptionUpdates[0]).toEqual(expect.objectContaining({
            plan: 'starter',
            billing_cycle: 'monthly',
            current_period_end: '2026-09-14T00:00:00.000Z',
        }))
        expect(profileUpdates).toContainEqual(expect.objectContaining({
            plan: 'starter',
            paid_until: '2026-09-14T00:00:00.000Z',
            grace_until: null,
            account_lifecycle_status: 'paid_active',
        }))
    })

    test('starts a fresh period from the payment date for active plan changes', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-07-20T10:00:00.000Z'))
        const { finalizePaymentRecord } = require('@/lib/payments/finalization')

        const { adminSupabase, profileUpdates, subscriptionUpdates } = createAdminSupabase({
            profile: {
                plan: 'starter',
                credits_balance: 300,
                credits_expire_at: null,
                paid_until: '2026-08-14T00:00:00.000Z',
                grace_until: null,
            },
            plan: {
                name: 'Pro',
                credits_included: 2500,
                price_fcfa: 19900,
                billing_cycle: 'monthly',
            },
            existingSub: {
                id: 'sub_2',
                current_period_end: '2026-08-14T00:00:00.000Z',
                billing_cycle: 'monthly',
            },
        })

        const payment = {
            id: 'payment_sub_plan_change',
            user_id: 'user_sub_plan_change',
            status: 'processing',
            payment_type: 'subscription',
            payment_provider: 'cinetpay',
            amount_fcfa: 19900,
            metadata: JSON.stringify({ type: 'subscription', plan_name: 'Pro' }),
            provider_response: null,
        }

        const finalized = await finalizePaymentRecord(adminSupabase, payment, 'ACCEPTED')

        expect(finalized.ok).toBe(true)
        expect(subscriptionUpdates).toHaveLength(1)
        expect(subscriptionUpdates[0]).toEqual(expect.objectContaining({
            plan: 'pro',
            billing_cycle: 'monthly',
            current_period_end: '2026-08-20T10:00:00.000Z',
        }))
        expect(profileUpdates).toContainEqual(expect.objectContaining({
            plan: 'pro',
            paid_until: '2026-08-20T10:00:00.000Z',
            grace_until: null,
            account_lifecycle_status: 'paid_active',
        }))
    })

    test('keeps the current paid window when credits are bought during an active paid period', async () => {
        jest.useFakeTimers().setSystemTime(new Date('2026-07-20T10:00:00.000Z'))
        const { finalizePaymentRecord } = require('@/lib/payments/finalization')

        const { adminSupabase, profileUpdates } = createAdminSupabase({
            profile: {
                plan: 'starter',
                credits_balance: 420,
                credits_expire_at: null,
                paid_until: '2026-08-14T00:00:00.000Z',
                grace_until: null,
            },
            rpcBalance: 620,
        })

        const payment = {
            id: 'payment_credits_active_window',
            user_id: 'user_credits_active_window',
            status: 'processing',
            payment_type: 'credits',
            payment_provider: 'paystack',
            amount_fcfa: 3000,
            credits_purchased: 200,
            provider_response: null,
        }

        const finalized = await finalizePaymentRecord(adminSupabase, payment, 'ACCEPTED')

        expect(finalized.ok).toBe(true)
        expect(finalized.newBalance).toBe(620)
        expect(profileUpdates).toContainEqual(expect.objectContaining({
            paid_until: '2026-08-14T00:00:00.000Z',
            grace_until: null,
            account_lifecycle_status: 'paid_active',
            credits_frozen_at: null,
            credits_expire_at: null,
        }))
    })
})

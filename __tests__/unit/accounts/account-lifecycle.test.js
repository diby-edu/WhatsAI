const {
    ACCOUNT_PAID_GRACE_DAYS,
    ACCOUNT_TEST_WINDOW_DAYS,
    buildAccountLifecycleAccessState,
    buildAccountLifecycleState,
    getAccountLifecycleBlockMessage,
    isLifecycleStatus,
    resolveGraceUntilFromPaidUntil,
    resolvePaidUntilForCreditsPurchase,
    resolvePaidUntilForPlanChange,
    resolvePaidUntilForSamePlanRenewal,
} = require('../../../src/lib/account-lifecycle')

describe('account lifecycle helpers', () => {
    const nowIso = '2026-07-14T12:00:00.000Z'
    const nowMs = new Date(nowIso).getTime()

    test('recognizes supported lifecycle statuses', () => {
        expect(isLifecycleStatus('test')).toBe(true)
        expect(isLifecycleStatus('paid_active')).toBe(true)
        expect(isLifecycleStatus('frozen_grace')).toBe(true)
        expect(isLifecycleStatus('inactive')).toBe(true)
        expect(isLifecycleStatus('legacy')).toBe(false)
    })

    test('builds a test-account countdown state from the cleanup deadline', () => {
        const cleanupDeadline = new Date(nowMs + ACCOUNT_TEST_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString()

        const state = buildAccountLifecycleState({
            testAccountCleanupDeadline: cleanupDeadline,
            testAccountQualifiedAt: null,
            paidUntil: null,
            graceUntil: null,
        }, nowMs)

        expect(state.status).toBe('test')
        expect(state.isTestAccount).toBe(true)
        expect(state.canAccessPaidFeatures).toBe(false)
        expect(state.remainingTestMs).toBeGreaterThan(0)
    })

    test('marks an active paid window as fully active', () => {
        const paidUntil = '2026-08-14T12:00:00.000Z'

        const state = buildAccountLifecycleState({
            testAccountCleanupDeadline: null,
            testAccountQualifiedAt: '2026-07-13T08:00:00.000Z',
            paidUntil,
            graceUntil: null,
        }, nowMs)

        expect(state.status).toBe('paid_active')
        expect(state.isPaidActive).toBe(true)
        expect(state.canAccessPaidFeatures).toBe(true)
        expect(state.remainingPaidMs).toBeGreaterThan(0)
    })

    test('marks an expired paid window with grace as frozen_grace', () => {
        const state = buildAccountLifecycleState({
            paidUntil: '2026-07-10T12:00:00.000Z',
            graceUntil: '2026-08-10T12:00:00.000Z',
            testAccountQualifiedAt: '2026-07-01T10:00:00.000Z',
        }, nowMs)

        expect(state.status).toBe('frozen_grace')
        expect(state.isFrozenGrace).toBe(true)
        expect(state.canAccessPaidFeatures).toBe(false)
        expect(state.shouldFreeze).toBe(false)
    })

    test('blocks agent provisioning during the paid grace window', () => {
        const access = buildAccountLifecycleAccessState({
            paidUntil: '2026-07-10T12:00:00.000Z',
            graceUntil: '2026-08-10T12:00:00.000Z',
            testAccountQualifiedAt: '2026-07-01T10:00:00.000Z',
        }, nowMs)

        expect(access.bannerMode).toBe('paid_grace')
        expect(access.shouldBlockAgentProvisioning).toBe(true)
        expect(getAccountLifecycleBlockMessage(access, 'agent_creation')).toMatch(/gele/i)
    })

    test('marks an expired grace window as inactive and ready for deferred deletion', () => {
        const state = buildAccountLifecycleState({
            paidUntil: '2026-07-10T12:00:00.000Z',
            graceUntil: '2026-07-13T12:00:00.000Z',
            testAccountQualifiedAt: '2026-07-01T10:00:00.000Z',
        }, nowMs)

        expect(state.status).toBe('inactive')
        expect(state.isInactive).toBe(true)
        expect(state.shouldDeleteAfterGrace).toBe(true)
    })

    test('blocks agent provisioning after grace if the account has paid-window history', () => {
        const access = buildAccountLifecycleAccessState({
            paidUntil: '2026-07-10T12:00:00.000Z',
            graceUntil: '2026-07-13T12:00:00.000Z',
            testAccountQualifiedAt: '2026-07-01T10:00:00.000Z',
        }, nowMs)

        expect(access.bannerMode).toBe('paid_expired')
        expect(access.shouldBlockAgentProvisioning).toBe(true)
        expect(getAccountLifecycleBlockMessage(access, 'whatsapp_connect')).toMatch(/paiement/i)
    })

    test('does not block test accounts that are still in their initial window', () => {
        const access = buildAccountLifecycleAccessState({
            testAccountCleanupDeadline: '2026-07-21T12:00:00.000Z',
            testAccountQualifiedAt: null,
            paidUntil: null,
            graceUntil: null,
        }, nowMs)

        expect(access.bannerMode).toBe('test')
        expect(access.shouldBlockAgentProvisioning).toBe(false)
        expect(getAccountLifecycleBlockMessage(access, 'agent_reactivation')).toBeNull()
    })

    test('same-plan renewal extends from the current paid_until anchor', () => {
        const nextPaidUntil = resolvePaidUntilForSamePlanRenewal(
            'monthly',
            '2026-08-14T12:00:00.000Z',
            nowMs
        )

        expect(nextPaidUntil).toBe('2026-09-14T12:00:00.000Z')
    })

    test('plan change starts a fresh period from the payment date', () => {
        const nextPaidUntil = resolvePaidUntilForPlanChange('monthly', new Date('2026-08-13T09:00:00.000Z').getTime())

        expect(nextPaidUntil).toBe('2026-09-13T09:00:00.000Z')
    })

    test('yearly plan change starts a fresh annual period from the payment date', () => {
        const nextPaidUntil = resolvePaidUntilForPlanChange('yearly', new Date('2026-01-10T07:00:00.000Z').getTime())

        expect(nextPaidUntil).toBe('2027-01-10T07:00:00.000Z')
    })

    test('credits purchased during an active paid period do not shift paid_until', () => {
        const nextPaidUntil = resolvePaidUntilForCreditsPurchase('2026-08-14T12:00:00.000Z', nowMs)

        expect(nextPaidUntil).toBe('2026-08-14T12:00:00.000Z')
    })

    test('credits purchased without an active paid period open a fresh one-month window', () => {
        const nextPaidUntil = resolvePaidUntilForCreditsPurchase(null, nowMs)

        expect(nextPaidUntil).toBe('2026-08-14T12:00:00.000Z')
    })

    test('grace_until starts from the paid_until reference by default', () => {
        const graceUntil = resolveGraceUntilFromPaidUntil('2026-08-14T12:00:00.000Z', nowMs)

        expect(graceUntil).toBe('2026-09-13T12:00:00.000Z')
        expect(ACCOUNT_PAID_GRACE_DAYS).toBe(30)
    })
})

const {
    TEST_ACCOUNT_GRACE_DAYS,
    buildTestAccountState,
    hasQualifyingAgentSignal,
    isProtectedProfileRole,
} = require('../../../src/lib/test-account')

describe('test-account lifecycle helpers', () => {
    const now = new Date('2026-04-02T12:00:00.000Z').getTime()

    test('recognizes protected roles', () => {
        expect(isProtectedProfileRole('admin')).toBe(true)
        expect(isProtectedProfileRole('superadmin')).toBe(true)
        expect(isProtectedProfileRole('support')).toBe(true)
        expect(isProtectedProfileRole('user')).toBe(false)
    })

    test('does not treat first-pairing qr_ready agents as qualified', () => {
        expect(hasQualifyingAgentSignal({
            whatsapp_ever_connected: false,
            whatsapp_connected: false,
            whatsapp_phone: null,
            whatsapp_status: 'qr_ready',
        })).toBe(false)
    })

    test('treats a previously connected or phone-linked agent as qualifying', () => {
        expect(hasQualifyingAgentSignal({
            whatsapp_ever_connected: true,
            whatsapp_connected: false,
            whatsapp_phone: null,
            whatsapp_status: 'qr_ready',
        })).toBe(true)

        expect(hasQualifyingAgentSignal({
            whatsapp_ever_connected: false,
            whatsapp_connected: false,
            whatsapp_phone: '22541859625',
            whatsapp_status: 'disconnected',
        })).toBe(true)
    })

    test('shows a countdown for active free test accounts inside the grace period', () => {
        const deadline = new Date(now + TEST_ACCOUNT_GRACE_DAYS * 24 * 60 * 60 * 1000).toISOString()
        const state = buildTestAccountState({
            plan: 'free',
            role: 'user',
            cleanupDeadline: deadline,
            completedPaymentsCount: 0,
            qualifyingAgentsCount: 0,
            qualifiedAt: null,
        }, now)

        expect(state.isTestAccount).toBe(true)
        expect(state.showCountdown).toBe(true)
        expect(state.isExpired).toBe(false)
        expect(state.shouldDelete).toBe(false)
        expect(state.remainingMs).toBeGreaterThan(0)
        expect(state.exitReason).toBeNull()
    })

    test('marks paid users as qualified immediately', () => {
        const state = buildTestAccountState({
            plan: 'free',
            role: 'user',
            cleanupDeadline: new Date(now + 3600000).toISOString(),
            completedPaymentsCount: 1,
            qualifyingAgentsCount: 0,
            qualifiedAt: null,
        }, now)

        expect(state.isTestAccount).toBe(false)
        expect(state.showCountdown).toBe(false)
        expect(state.shouldDelete).toBe(false)
        expect(state.exitReason).toBe('paid')
    })

    test('marks users with a prior qualified history as safe even without current agents', () => {
        const state = buildTestAccountState({
            plan: 'free',
            role: 'user',
            cleanupDeadline: new Date(now - 1000).toISOString(),
            completedPaymentsCount: 0,
            qualifyingAgentsCount: 0,
            qualifiedAt: '2026-04-01T10:00:00.000Z',
        }, now)

        expect(state.isTestAccount).toBe(false)
        expect(state.showCountdown).toBe(false)
        expect(state.shouldDelete).toBe(false)
        expect(state.exitReason).toBe('qualified')
    })

    test('expires only accounts that are still true test accounts at deadline', () => {
        const state = buildTestAccountState({
            plan: 'free',
            role: 'user',
            cleanupDeadline: '2026-04-01T11:59:59.000Z',
            completedPaymentsCount: 0,
            qualifyingAgentsCount: 0,
            qualifiedAt: null,
        }, now)

        expect(state.isTestAccount).toBe(true)
        expect(state.isExpired).toBe(true)
        expect(state.shouldDelete).toBe(true)
    })
})

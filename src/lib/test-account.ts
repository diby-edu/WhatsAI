import { buildAccountLifecycleAccessState } from './account-lifecycle'

export const TEST_ACCOUNT_GRACE_DAYS = 7

const PROTECTED_ROLES = new Set(['admin', 'superadmin', 'support'])
const QUALIFYING_AGENT_STATUSES = new Set(['connected', 'reconnect_required', 'disconnected'])

type SupabaseClientLike = any

export type TestAccountSignals = {
    plan?: string | null
    role?: string | null
    cleanupDeadline?: string | null
    qualifiedAt?: string | null
    completedPaymentsCount?: number | null
    qualifyingAgentsCount?: number | null
}

export type TestAccountState = {
    isFreePlan: boolean
    isProtectedRole: boolean
    hasCompletedPayments: boolean
    hasQualifiedHistory: boolean
    hasQualifyingAgent: boolean
    isTestAccount: boolean
    showCountdown: boolean
    isExpired: boolean
    shouldDelete: boolean
    cleanupDeadline: string | null
    remainingMs: number | null
    exitReason: 'protected_role' | 'paid' | 'qualified' | 'connected_agent' | 'not_free' | null
}

export function isProtectedProfileRole(role?: string | null): boolean {
    return PROTECTED_ROLES.has(String(role || '').trim().toLowerCase())
}

export function hasQualifyingAgentSignal(agent: {
    whatsapp_ever_connected?: boolean | null
    whatsapp_connected?: boolean | null
    whatsapp_phone?: string | null
    whatsapp_status?: string | null
} | null | undefined): boolean {
    if (!agent) return false

    if (agent.whatsapp_ever_connected === true) return true
    if (agent.whatsapp_connected === true) return true
    if (typeof agent.whatsapp_phone === 'string' && agent.whatsapp_phone.trim().length > 0) return true

    const status = String(agent.whatsapp_status || '').trim().toLowerCase()
    return QUALIFYING_AGENT_STATUSES.has(status)
}

export function buildTestAccountState(
    signals: TestAccountSignals,
    nowMs: number = Date.now()
): TestAccountState {
    const isFreePlan = String(signals.plan || 'free').trim().toLowerCase() === 'free'
    const isProtectedRole = isProtectedProfileRole(signals.role)
    const hasCompletedPayments = Number(signals.completedPaymentsCount || 0) > 0
    const hasQualifiedHistory = Boolean(signals.qualifiedAt)
    const hasQualifyingAgent = Number(signals.qualifyingAgentsCount || 0) > 0

    const isTestAccount = (
        isFreePlan &&
        !isProtectedRole &&
        !hasCompletedPayments &&
        !hasQualifiedHistory
    )

    const cleanupDeadline = signals.cleanupDeadline || null
    const parsedDeadlineMs = cleanupDeadline ? new Date(cleanupDeadline).getTime() : null
    const deadlineMs = typeof parsedDeadlineMs === 'number' && Number.isFinite(parsedDeadlineMs)
        ? parsedDeadlineMs
        : null
    const showCountdown = isTestAccount && deadlineMs !== null
    const rawRemainingMs = showCountdown && deadlineMs !== null ? deadlineMs - nowMs : null
    const remainingMs = rawRemainingMs === null ? null : Math.max(0, rawRemainingMs)
    const isExpired = showCountdown && deadlineMs !== null ? deadlineMs <= nowMs : false

    let exitReason: TestAccountState['exitReason'] = null
    if (!isFreePlan) exitReason = 'not_free'
    else if (isProtectedRole) exitReason = 'protected_role'
    else if (hasCompletedPayments) exitReason = 'paid'
    else if (hasQualifiedHistory) exitReason = 'qualified'

    return {
        isFreePlan,
        isProtectedRole,
        hasCompletedPayments,
        hasQualifiedHistory,
        hasQualifyingAgent,
        isTestAccount,
        showCountdown,
        isExpired,
        shouldDelete: isTestAccount && isExpired,
        cleanupDeadline,
        remainingMs,
        exitReason,
    }
}

export async function fetchUserTestAccountState(
    adminSupabase: SupabaseClientLike,
    userId: string,
    nowMs: number = Date.now()
) {
    const { data: profile, error: profileError } = await adminSupabase
        .from('profiles')
        .select('id, email, full_name, plan, role, test_account_cleanup_deadline, test_account_qualified_at, paid_until, grace_until, account_lifecycle_status')
        .eq('id', userId)
        .maybeSingle()

    if (profileError?.code === '42703') {
        const fallback = await adminSupabase
            .from('profiles')
            .select('id, email, full_name, plan, role, test_account_cleanup_deadline, test_account_qualified_at')
            .eq('id', userId)
            .maybeSingle()

        if (fallback.error) throw fallback.error
        if (!fallback.data) return null

        const [{ count: completedPaymentsCount, error: paymentsError }, { data: agents, error: agentsError }] = await Promise.all([
            adminSupabase
                .from('payments')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', userId)
                .eq('status', 'completed')
                .eq('payment_type', 'subscription'),
            adminSupabase
                .from('agents')
                .select('whatsapp_ever_connected, whatsapp_connected, whatsapp_phone, whatsapp_status')
                .eq('user_id', userId),
        ])

        if (paymentsError) throw paymentsError
        if (agentsError) throw agentsError

        const qualifyingAgentsCount = (agents || []).filter(hasQualifyingAgentSignal).length
        const state = buildTestAccountState({
            plan: fallback.data.plan,
            role: fallback.data.role,
            cleanupDeadline: fallback.data.test_account_cleanup_deadline,
            qualifiedAt: fallback.data.test_account_qualified_at,
            completedPaymentsCount,
            qualifyingAgentsCount,
        }, nowMs)

        const lifecycleAccess = buildAccountLifecycleAccessState({
            testAccountCleanupDeadline: fallback.data.test_account_cleanup_deadline,
            testAccountQualifiedAt: fallback.data.test_account_qualified_at,
            paidUntil: null,
            graceUntil: null,
        }, nowMs)

        return {
            ...state,
            lifecycleAccess,
            profile: fallback.data,
            completedPaymentsCount: Number(completedPaymentsCount || 0),
            qualifyingAgentsCount,
        }
    }

    if (profileError) throw profileError
    if (!profile) return null

    const [{ count: completedPaymentsCount, error: paymentsError }, { data: agents, error: agentsError }] = await Promise.all([
        adminSupabase
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('status', 'completed')
            .eq('payment_type', 'subscription'),
        adminSupabase
            .from('agents')
            .select('whatsapp_ever_connected, whatsapp_connected, whatsapp_phone, whatsapp_status')
            .eq('user_id', userId),
    ])

    if (paymentsError) throw paymentsError
    if (agentsError) throw agentsError

    const qualifyingAgentsCount = (agents || []).filter(hasQualifyingAgentSignal).length
    const state = buildTestAccountState({
        plan: profile.plan,
        role: profile.role,
        cleanupDeadline: profile.test_account_cleanup_deadline,
        qualifiedAt: profile.test_account_qualified_at,
        completedPaymentsCount,
        qualifyingAgentsCount,
    }, nowMs)
    const lifecycleAccess = buildAccountLifecycleAccessState({
        testAccountCleanupDeadline: profile.test_account_cleanup_deadline,
        testAccountQualifiedAt: profile.test_account_qualified_at,
        paidUntil: profile.paid_until,
        graceUntil: profile.grace_until,
    }, nowMs)

    return {
        ...state,
        lifecycleAccess,
        profile,
        completedPaymentsCount: Number(completedPaymentsCount || 0),
        qualifyingAgentsCount,
    }
}

export async function listUsersWithExpiredTestCleanupDeadline(
    adminSupabase: SupabaseClientLike,
    nowMs: number = Date.now()
) {
    const { data, error } = await adminSupabase
        .from('profiles')
        .select('id, email, full_name, plan, role, test_account_cleanup_deadline, test_account_qualified_at')
        .not('test_account_cleanup_deadline', 'is', null)
        .lte('test_account_cleanup_deadline', new Date(nowMs).toISOString())

    if (error) throw error

    return (data || []).filter((profile: any) => !isProtectedProfileRole(profile.role))
}

export async function listUsersWithExpiredPaidGraceWindow(
    adminSupabase: SupabaseClientLike,
    nowMs: number = Date.now()
) {
    const query = await adminSupabase
        .from('profiles')
        .select('id, email, full_name, plan, role, paid_until, grace_until, account_lifecycle_status, test_account_qualified_at, test_account_cleanup_deadline')
        .not('grace_until', 'is', null)
        .lte('grace_until', new Date(nowMs).toISOString())

    if (query.error?.code === '42703') {
        return []
    }

    if (query.error) throw query.error

    return (query.data || []).filter((profile: any) => {
        if (isProtectedProfileRole(profile.role)) return false
        if (!profile.paid_until || !profile.grace_until) return false

        return true
    })
}

export async function markUserAsQualified(
    adminSupabase: SupabaseClientLike,
    userId: string,
    qualifiedAt: string = new Date().toISOString()
) {
    const { error } = await adminSupabase
        .from('profiles')
        .update({
            test_account_qualified_at: qualifiedAt,
            test_account_cleanup_deadline: null,
        })
        .eq('id', userId)

    if (error) throw error
}

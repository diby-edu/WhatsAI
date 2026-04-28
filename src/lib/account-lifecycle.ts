import { addDays, addMonths, addYears } from 'date-fns'

export const ACCOUNT_TEST_WINDOW_DAYS = 7
export const ACCOUNT_PAID_GRACE_DAYS = 30

export const ACCOUNT_LIFECYCLE_STATUSES = [
    'test',
    'paid_active',
    'frozen_grace',
    'inactive',
] as const

export type AccountLifecycleStatus = typeof ACCOUNT_LIFECYCLE_STATUSES[number]
export type AccountBillingCycle = 'monthly' | 'yearly'

export type AccountLifecycleSignals = {
    testAccountCleanupDeadline?: string | null
    testAccountQualifiedAt?: string | null
    paidUntil?: string | null
    graceUntil?: string | null
}

export type AccountLifecycleState = {
    status: AccountLifecycleStatus
    isTestAccount: boolean
    isPaidActive: boolean
    isFrozenGrace: boolean
    isInactive: boolean
    canAccessPaidFeatures: boolean
    shouldFreeze: boolean
    shouldDeleteAfterGrace: boolean
    testAccountCleanupDeadline: string | null
    paidUntil: string | null
    graceUntil: string | null
    remainingTestMs: number | null
    remainingPaidMs: number | null
    remainingGraceMs: number | null
}

export type AccountLifecycleBannerMode = 'test' | 'frozen_grace' | 'inactive'

export type AccountLifecycleAccessState = {
    lifecycle: AccountLifecycleState
    hasPaidWindowHistory: boolean
    shouldBlockAgentProvisioning: boolean
    bannerMode: AccountLifecycleBannerMode | null
}

function parseDateMs(value?: string | null): number | null {
    if (!value) return null

    const parsed = new Date(value).getTime()
    return Number.isFinite(parsed) ? parsed : null
}

function addBillingCycle(baseDate: Date, billingCycle: AccountBillingCycle): Date {
    return billingCycle === 'yearly'
        ? addYears(baseDate, 1)
        : addMonths(baseDate, 1)
}

export function isLifecycleStatus(value?: string | null): value is AccountLifecycleStatus {
    return ACCOUNT_LIFECYCLE_STATUSES.includes(value as AccountLifecycleStatus)
}

export function buildAccountLifecycleState(
    signals: AccountLifecycleSignals,
    nowMs: number = Date.now()
): AccountLifecycleState {
    const testDeadlineMs = parseDateMs(signals.testAccountCleanupDeadline)
    const paidUntilMs = parseDateMs(signals.paidUntil)
    const graceUntilMs = parseDateMs(signals.graceUntil)
    const hasQualifiedTestHistory = Boolean(signals.testAccountQualifiedAt)

    const isPaidActive = paidUntilMs !== null && paidUntilMs > nowMs
    const isFrozenGrace = !isPaidActive && graceUntilMs !== null && graceUntilMs > nowMs
    const isTestAccount = !isPaidActive && !isFrozenGrace && !hasQualifiedTestHistory && testDeadlineMs !== null
    const isInactive = !isTestAccount && !isPaidActive && !isFrozenGrace

    const status: AccountLifecycleStatus = isPaidActive
        ? 'paid_active'
        : isFrozenGrace
            ? 'frozen_grace'
            : isTestAccount
                ? 'test'
                : 'inactive'

    const remainingTestMs = isTestAccount && testDeadlineMs !== null
        ? Math.max(0, testDeadlineMs - nowMs)
        : null
    const remainingPaidMs = isPaidActive && paidUntilMs !== null
        ? Math.max(0, paidUntilMs - nowMs)
        : null
    const remainingGraceMs = isFrozenGrace && graceUntilMs !== null
        ? Math.max(0, graceUntilMs - nowMs)
        : null

    return {
        status,
        isTestAccount,
        isPaidActive,
        isFrozenGrace,
        isInactive,
        canAccessPaidFeatures: isPaidActive,
        shouldFreeze: !isPaidActive && paidUntilMs !== null && paidUntilMs <= nowMs && !isFrozenGrace,
        shouldDeleteAfterGrace: !isPaidActive && graceUntilMs !== null && graceUntilMs <= nowMs,
        testAccountCleanupDeadline: signals.testAccountCleanupDeadline || null,
        paidUntil: signals.paidUntil || null,
        graceUntil: signals.graceUntil || null,
        remainingTestMs,
        remainingPaidMs,
        remainingGraceMs,
    }
}

export function buildAccountLifecycleAccessState(
    signals: AccountLifecycleSignals,
    nowMs: number = Date.now()
): AccountLifecycleAccessState {
    const lifecycle = buildAccountLifecycleState(signals, nowMs)
    const hasPaidWindowHistory = Boolean(signals.paidUntil || signals.graceUntil)

    if (lifecycle.isTestAccount) {
        return {
            lifecycle,
            hasPaidWindowHistory,
            shouldBlockAgentProvisioning: false,
            bannerMode: 'test',
        }
    }

    if (lifecycle.isFrozenGrace) {
        return {
            lifecycle,
            hasPaidWindowHistory,
            shouldBlockAgentProvisioning: true,
            bannerMode: 'frozen_grace',
        }
    }

    if (hasPaidWindowHistory && !lifecycle.isPaidActive) {
        return {
            lifecycle,
            hasPaidWindowHistory,
            shouldBlockAgentProvisioning: true,
            bannerMode: 'inactive',
        }
    }

    return {
        lifecycle,
        hasPaidWindowHistory,
        shouldBlockAgentProvisioning: false,
        bannerMode: null,
    }
}

export function getAccountLifecycleBlockMessage(
    accessState: AccountLifecycleAccessState,
    actionLabel: 'agent_creation' | 'agent_reactivation' | 'whatsapp_connect'
): string | null {
    if (!accessState.shouldBlockAgentProvisioning) {
        return null
    }

    const actionText = actionLabel === 'agent_creation'
        ? 'creer un nouvel agent'
        : actionLabel === 'agent_reactivation'
            ? 'reactiver cet agent'
            : 'connecter WhatsApp'

    if (accessState.bannerMode === 'frozen_grace') {
        const hasPaidHistory = Boolean(accessState.lifecycle.paidUntil)
        if (hasPaidHistory) {
            return `Votre abonnement a expire. Renouvelez votre abonnement pour ${actionText}.`
        }
        return `Votre periode d'essai est terminee. Souscrivez un abonnement pour ${actionText}.`
    }

    const hasPaidHistory = Boolean(accessState.lifecycle.paidUntil)
    if (hasPaidHistory) {
        return `Votre abonnement a expire et la periode de grace est ecoulee. Un nouveau paiement est requis pour ${actionText}.`
    }
    return `Votre periode d'essai est definitivement expirée. Souscrivez un abonnement pour ${actionText}.`
}

export function resolvePaidUntilForSamePlanRenewal(
    billingCycle: AccountBillingCycle,
    currentPaidUntil?: string | null,
    nowMs: number = Date.now()
): string {
    const currentPaidUntilMs = parseDateMs(currentPaidUntil)
    const anchorDate = currentPaidUntilMs !== null && currentPaidUntilMs > nowMs
        ? new Date(currentPaidUntilMs)
        : new Date(nowMs)

    return addBillingCycle(anchorDate, billingCycle).toISOString()
}

export function resolvePaidUntilForPlanChange(
    billingCycle: AccountBillingCycle,
    nowMs: number = Date.now()
): string {
    return addBillingCycle(new Date(nowMs), billingCycle).toISOString()
}

export function resolvePaidUntilForCreditsPurchase(
    currentPaidUntil?: string | null,
    nowMs: number = Date.now()
): string {
    const currentPaidUntilMs = parseDateMs(currentPaidUntil)

    if (currentPaidUntilMs !== null && currentPaidUntilMs > nowMs) {
        return new Date(currentPaidUntilMs).toISOString()
    }

    return addMonths(new Date(nowMs), 1).toISOString()
}

export function resolveGraceUntilFromPaidUntil(
    paidUntil?: string | null,
    nowMs: number = Date.now(),
    graceDays: number = ACCOUNT_PAID_GRACE_DAYS
): string {
    const paidUntilMs = parseDateMs(paidUntil)
    const referenceMs = paidUntilMs ?? nowMs

    return addDays(new Date(referenceMs), graceDays).toISOString()
}

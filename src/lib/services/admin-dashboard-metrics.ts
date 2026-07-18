import { PLANS } from '@/lib/plans'

interface SubPayment {
    user_id: string | null
    amount_fcfa: number | null
}

export function calculateMrrMetrics({
    subPaymentsThisMonth,
    subPaymentsLastMonth,
    allSubPaymentsBeforeMonth,
}: {
    subPaymentsThisMonth: SubPayment[] | null
    subPaymentsLastMonth: { amount_fcfa: number | null }[] | null
    allSubPaymentsBeforeMonth: { user_id: string | null }[] | null
}) {
    const mrr = subPaymentsThisMonth?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
    const mrrLastMonth = subPaymentsLastMonth?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
    const mrrGrowth = mrrLastMonth > 0 ? Math.round(((mrr - mrrLastMonth) / mrrLastMonth) * 100) : 0

    // New MRR = abonnements de nouveaux clients (premier achat ce mois)
    const existingSubUserIds = new Set((allSubPaymentsBeforeMonth || []).map(p => p.user_id))
    const newSubPayments = (subPaymentsThisMonth || []).filter(p => !existingSubUserIds.has(p.user_id))
    const newMrr = newSubPayments.reduce((s, p) => s + (p.amount_fcfa || 0), 0)

    return { mrr, mrrLastMonth, mrrGrowth, newMrr, newSubPayments }
}

export function calculatePlatformRevenue(
    allPlatformPayments: { amount_fcfa: number | null; payment_method_source: string | null }[] | null
) {
    const platformRevenue = allPlatformPayments?.reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
    const revenueAutomatic = allPlatformPayments?.filter(p => p.payment_method_source !== 'manual').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0
    const revenueManual = allPlatformPayments?.filter(p => p.payment_method_source === 'manual').reduce((s, p) => s + (p.amount_fcfa || 0), 0) || 0

    return { platformRevenue, revenueAutomatic, revenueManual }
}

export function calculateChurnedMrr(churnedProfiles: { plan: string | null }[] | null) {
    const churnedCount = churnedProfiles?.length || 0
    const churnedMrr = (churnedProfiles || []).reduce((s, p) => {
        const planPrice = PLANS[p.plan as keyof typeof PLANS]?.price || 0
        return s + planPrice
    }, 0)

    return { churnedMrr, churnedCount }
}

export function calculateSaasMetrics({
    activeSubscribers,
    churnedCount,
    mrr,
}: {
    activeSubscribers: number
    churnedCount: number
    mrr: number
}) {
    const totalAtRisk = activeSubscribers + churnedCount
    const churnRate = totalAtRisk > 0 ? parseFloat(((churnedCount / totalAtRisk) * 100).toFixed(1)) : 0
    const arpu = activeSubscribers > 0 ? Math.round(mrr / (activeSubscribers || 1)) : 0
    const ltv = churnRate > 0 ? Math.round(arpu / (churnRate / 100)) : arpu * 12

    return { churnRate, arpu, ltv }
}

export function calculateAgentActivationRate({
    connectedAgentUserIds,
    payingProfiles,
}: {
    connectedAgentUserIds: { user_id: string | null }[] | null
    payingProfiles: { id: string }[] | null
}) {
    const payingIds = new Set((payingProfiles || []).map(p => p.id))
    const activatedCount = (connectedAgentUserIds || []).filter(a => payingIds.has(a.user_id as string)).length
    return payingIds.size > 0 ? Math.round((activatedCount / payingIds.size) * 100) : 0
}

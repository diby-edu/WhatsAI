import type { SupabaseClient } from '@supabase/supabase-js'
import { getAgentOperationalLabel, getAgentOperationalStatus } from '@/lib/admin/agent-status'

type AdminAlert = {
    type: string
    resource_id: string
    label: string
    message: string
    severity: 'critical' | 'warning' | 'info'
    days_since_active: number
    created_at?: string
}

function daysSince(dateValue?: string | null) {
    if (!dateValue) return 0
    const diff = Date.now() - new Date(dateValue).getTime()
    if (!Number.isFinite(diff) || diff <= 0) return 0
    return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function sortAlerts(alerts: AdminAlert[]) {
    const weight: Record<AdminAlert['severity'], number> = {
        critical: 3,
        warning: 2,
        info: 1,
    }

    return alerts.sort((a, b) => {
        const severityDelta = weight[b.severity] - weight[a.severity]
        if (severityDelta !== 0) return severityDelta
        return b.days_since_active - a.days_since_active
    })
}

export async function getAgentOperationalMetrics(adminSupabase: SupabaseClient) {
    const { data: agents, error } = await adminSupabase
        .from('agents')
        .select('id, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone')

    if (error) throw error

    const counts = {
        total: 0,
        connected: 0,
        paused: 0,
        qr_ready: 0,
        reconnect_required: 0,
    }

    for (const agent of agents || []) {
        const status = getAgentOperationalStatus(agent)
        counts.total += 1
        if (status === 'connected') counts.connected += 1
        if (status === 'paused') counts.paused += 1
        if (status === 'qr_ready') counts.qr_ready += 1
        if (status === 'reconnect_required') counts.reconnect_required += 1
    }

    return counts
}

export async function buildAdminAlerts(adminSupabase: SupabaseClient): Promise<AdminAlert[]> {
    const [agentsResult, lowCreditsResult, paymentsResult, payoutsResult] = await Promise.all([
        adminSupabase
            .from('agents')
            .select('id, name, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, last_message_at, updated_at'),
        adminSupabase
            .from('profiles')
            .select('id, full_name, credits_balance')
            .lt('credits_balance', 10),
        adminSupabase
            .from('payments')
            .select('user_id, amount_fcfa')
            .eq('status', 'completed')
            .eq('payment_type', 'one_time'),
        adminSupabase
            .from('payouts')
            .select('user_id, net_amount, commission_amount')
            .eq('status', 'completed'),
    ])

    if (agentsResult.error) throw agentsResult.error
    if (lowCreditsResult.error) throw lowCreditsResult.error
    if (paymentsResult.error) throw paymentsResult.error
    if (payoutsResult.error) throw payoutsResult.error

    const alerts: AdminAlert[] = []

    for (const agent of agentsResult.data || []) {
        const status = getAgentOperationalStatus(agent)
        if (status !== 'reconnect_required') continue

        alerts.push({
            type: 'agent_disconnect',
            resource_id: agent.id,
            label: agent.name || 'Agent',
            message: getAgentOperationalLabel(status),
            severity: 'critical',
            days_since_active: daysSince(agent.last_message_at || agent.updated_at),
            created_at: agent.updated_at,
        })
    }

    for (const profile of lowCreditsResult.data || []) {
        alerts.push({
            type: 'low_credits',
            resource_id: profile.id,
            label: profile.full_name || 'Utilisateur',
            message: 'Solde inferieur a 10 credits',
            severity: 'warning',
            days_since_active: 0,
        })
    }

    const payoutsByUser = new Map<string, { collected: number; paid: number }>()

    for (const payment of paymentsResult.data || []) {
        const current = payoutsByUser.get(payment.user_id) || { collected: 0, paid: 0 }
        current.collected += payment.amount_fcfa || 0
        payoutsByUser.set(payment.user_id, current)
    }

    for (const payout of payoutsResult.data || []) {
        const current = payoutsByUser.get(payout.user_id) || { collected: 0, paid: 0 }
        current.paid += (payout.net_amount || 0) + (payout.commission_amount || 0)
        payoutsByUser.set(payout.user_id, current)
    }

    const highBalanceIds = Array.from(payoutsByUser.entries())
        .filter(([, value]) => value.collected - value.paid > 50000)
        .map(([userId]) => userId)

    if (highBalanceIds.length > 0) {
        const { data: profiles } = await adminSupabase
            .from('profiles')
            .select('id, full_name')
            .in('id', highBalanceIds)

        for (const profile of profiles || []) {
            alerts.push({
                type: 'high_merchant_balance',
                resource_id: profile.id,
                label: profile.full_name || 'Marchand',
                message: 'Solde a reverser eleve (> 50k)',
                severity: 'warning',
                days_since_active: 0,
            })
        }
    }

    return sortAlerts(alerts)
}

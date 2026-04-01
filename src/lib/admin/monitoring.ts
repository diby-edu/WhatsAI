import type { SupabaseClient } from '@supabase/supabase-js'
import { getAgentOperationalStatus, hasAgentConnectedBefore, type AgentOperationalStatus, type AgentStatusLike } from '@/lib/admin/agent-status'

type AdminAlert = {
    type: string
    resource_id: string
    label: string
    message: string
    severity: 'critical' | 'warning' | 'info'
    days_since_active: number
    created_at?: string
}

type WhatsAppRiskSeverity = 'critical' | 'warning'

type WhatsAppRiskReason =
    | 'connecting_stalled'
    | 'reconnect_qr_ready'
    | 'reconnect_required'
    | 'first_pairing_qr_ready'

type WhatsAppRiskAgent = AgentStatusLike & {
    id: string
    name?: string | null
    user_id?: string | null
    whatsapp_qr_code?: string | null
    last_message_at?: string | null
    updated_at?: string | null
}

export type WhatsAppRiskEntry = {
    id: string
    name: string
    user_id: string | null
    operational_status: AgentOperationalStatus
    whatsapp_status: string | null
    severity: WhatsAppRiskSeverity
    reason: WhatsAppRiskReason
    message: string
    minutes_since_update: number
    minutes_since_last_message: number
    has_qr: boolean
    updated_at?: string | null
    last_message_at?: string | null
}

export const WHATSAPP_RISK_THRESHOLDS_MINUTES = {
    connecting_stalled: 5,
    reconnect_qr_ready: 5,
    reconnect_required: 15,
    first_pairing_qr_ready: 30,
} as const

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

function minutesSince(dateValue?: string | null, nowMs = Date.now()) {
    if (!dateValue) return 0
    const diff = nowMs - new Date(dateValue).getTime()
    if (!Number.isFinite(diff) || diff <= 0) return 0
    return Math.floor(diff / (1000 * 60))
}

function sortRiskEntries(entries: WhatsAppRiskEntry[]) {
    const weight: Record<WhatsAppRiskSeverity, number> = {
        critical: 2,
        warning: 1,
    }

    return entries.sort((a, b) => {
        const severityDelta = weight[b.severity] - weight[a.severity]
        if (severityDelta !== 0) return severityDelta
        return b.minutes_since_update - a.minutes_since_update
    })
}

function buildRiskEntry(agent: WhatsAppRiskAgent, params: {
    operationalStatus: AgentOperationalStatus
    severity: WhatsAppRiskSeverity
    reason: WhatsAppRiskReason
    message: string
    minutesSinceUpdate: number
    minutesSinceLastMessage: number
}): WhatsAppRiskEntry {
    return {
        id: agent.id,
        name: agent.name || 'Agent',
        user_id: agent.user_id || null,
        operational_status: params.operationalStatus,
        whatsapp_status: agent.whatsapp_status || null,
        severity: params.severity,
        reason: params.reason,
        message: params.message,
        minutes_since_update: params.minutesSinceUpdate,
        minutes_since_last_message: params.minutesSinceLastMessage,
        has_qr: Boolean(agent.whatsapp_qr_code),
        updated_at: agent.updated_at,
        last_message_at: agent.last_message_at,
    }
}

export function buildWhatsAppRiskSnapshot(agents: WhatsAppRiskAgent[], nowMs = Date.now()) {
    const atRiskAgents: WhatsAppRiskEntry[] = []

    for (const agent of agents || []) {
        if (agent.is_active === false) continue

        const operationalStatus = getAgentOperationalStatus(agent)
        const minutesSinceUpdate = minutesSince(agent.updated_at, nowMs)
        const minutesSinceLastMessage = minutesSince(agent.last_message_at, nowMs)
        const connectedBefore = hasAgentConnectedBefore(agent)

        if (agent.whatsapp_status === 'connecting' && minutesSinceUpdate >= WHATSAPP_RISK_THRESHOLDS_MINUTES.connecting_stalled) {
            atRiskAgents.push(buildRiskEntry(agent, {
                operationalStatus,
                severity: 'critical',
                reason: 'connecting_stalled',
                message: `Pairing WhatsApp bloque en phase de connexion depuis ${minutesSinceUpdate} min`,
                minutesSinceUpdate,
                minutesSinceLastMessage,
            }))
            continue
        }

        if (agent.whatsapp_status === 'qr_ready' && connectedBefore && minutesSinceUpdate >= WHATSAPP_RISK_THRESHOLDS_MINUTES.reconnect_qr_ready) {
            atRiskAgents.push(buildRiskEntry(agent, {
                operationalStatus,
                severity: 'critical',
                reason: 'reconnect_qr_ready',
                message: `Agent deja connecte mais retombe en QR depuis ${minutesSinceUpdate} min`,
                minutesSinceUpdate,
                minutesSinceLastMessage,
            }))
            continue
        }

        if (operationalStatus === 'reconnect_required' && minutesSinceUpdate >= WHATSAPP_RISK_THRESHOLDS_MINUTES.reconnect_required) {
            atRiskAgents.push(buildRiskEntry(agent, {
                operationalStatus,
                severity: 'critical',
                reason: 'reconnect_required',
                message: `Connexion WhatsApp perdue depuis ${minutesSinceUpdate} min`,
                minutesSinceUpdate,
                minutesSinceLastMessage,
            }))
            continue
        }

        if (agent.whatsapp_status === 'qr_ready' && !connectedBefore && minutesSinceUpdate >= WHATSAPP_RISK_THRESHOLDS_MINUTES.first_pairing_qr_ready) {
            atRiskAgents.push(buildRiskEntry(agent, {
                operationalStatus,
                severity: 'warning',
                reason: 'first_pairing_qr_ready',
                message: `Premier QR non scanne depuis ${minutesSinceUpdate} min`,
                minutesSinceUpdate,
                minutesSinceLastMessage,
            }))
        }
    }

    const sorted = sortRiskEntries(atRiskAgents)

    return {
        thresholds_minutes: WHATSAPP_RISK_THRESHOLDS_MINUTES,
        total: sorted.length,
        critical: sorted.filter((entry) => entry.severity === 'critical').length,
        warning: sorted.filter((entry) => entry.severity === 'warning').length,
        agents: sorted,
    }
}

export async function getAgentOperationalMetrics(adminSupabase: SupabaseClient) {
    const { data: agents, error } = await adminSupabase
        .from('agents')
        .select('id, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, whatsapp_ever_connected')

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

export async function getWhatsAppRiskReport(adminSupabase: SupabaseClient) {
    const { data: agents, error } = await adminSupabase
        .from('agents')
        .select('id, user_id, name, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, whatsapp_qr_code, whatsapp_ever_connected, last_message_at, updated_at')

    if (error) throw error

    return buildWhatsAppRiskSnapshot(agents || [])
}

export async function buildAdminAlerts(adminSupabase: SupabaseClient): Promise<AdminAlert[]> {
    const [agentsResult, lowCreditsResult, paymentsResult, payoutsResult] = await Promise.all([
        adminSupabase
            .from('agents')
            .select('id, user_id, name, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, whatsapp_qr_code, whatsapp_ever_connected, last_message_at, updated_at'),
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
    const whatsAppRiskReport = buildWhatsAppRiskSnapshot(agentsResult.data || [])

    for (const risk of whatsAppRiskReport.agents) {
        alerts.push({
            type: `whatsapp_${risk.reason}`,
            resource_id: risk.id,
            label: risk.name || 'Agent',
            message: risk.message,
            severity: risk.severity,
            days_since_active: daysSince(risk.last_message_at || risk.updated_at),
            created_at: risk.updated_at || undefined,
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

import { getAgentOperationalStatus, type AgentOperationalStatus } from '@/lib/admin/agent-status'

export type BroadcastTargetSegment =
    | 'all'
    | 'free'
    | 'starter'
    | 'pro'
    | 'business'
    | 'agent_connected'
    | 'agent_paused'
    | 'agent_reconnect_required'
    | 'agent_qr_ready'

export interface BroadcastRecipientProfile {
    id: string
    email: string | null
    full_name: string | null
    plan: string | null
}

const PLAN_SEGMENTS = new Set<BroadcastTargetSegment>([
    'all',
    'free',
    'starter',
    'pro',
    'business',
])

const AGENT_SEGMENT_TO_STATUS: Record<string, AgentOperationalStatus> = {
    agent_connected: 'connected',
    agent_paused: 'paused',
    agent_reconnect_required: 'reconnect_required',
    agent_qr_ready: 'qr_ready',
}

function normalizeSegment(segment?: string | null): BroadcastTargetSegment {
    switch (segment) {
        case 'free':
        case 'starter':
        case 'pro':
        case 'business':
        case 'agent_connected':
        case 'agent_paused':
        case 'agent_reconnect_required':
        case 'agent_qr_ready':
            return segment
        case 'all':
        default:
            return 'all'
    }
}

function isPlanSegment(segment: BroadcastTargetSegment) {
    return PLAN_SEGMENTS.has(segment)
}

async function fetchProfiles(
    adminSupabase: any,
    userIds?: string[],
    requireEmail?: boolean
): Promise<BroadcastRecipientProfile[]> {
    let query = adminSupabase.from('profiles').select('id, email, full_name, plan')

    if (Array.isArray(userIds)) {
        if (userIds.length === 0) return []
        query = query.in('id', userIds)
    }

    if (requireEmail) {
        query = query.not('email', 'is', null)
    }

    const { data, error } = await query
    if (error) throw error

    return (data || []) as BroadcastRecipientProfile[]
}

async function getUserIdsForAgentStatus(adminSupabase: any, status: AgentOperationalStatus): Promise<string[]> {
    const { data, error } = await adminSupabase
        .from('agents')
        .select('user_id, is_active, whatsapp_connected, whatsapp_status, whatsapp_phone, whatsapp_ever_connected')
        .not('user_id', 'is', null)

    if (error) throw error

    const userIds = new Set<string>()

    for (const agent of data || []) {
        if (!agent.user_id) continue
        if (getAgentOperationalStatus(agent) === status) {
            userIds.add(agent.user_id)
        }
    }

    return [...userIds]
}

export async function getProfilesForBroadcastSegment(
    adminSupabase: any,
    segment?: string | null,
    options?: { requireEmail?: boolean }
): Promise<BroadcastRecipientProfile[]> {
    const normalizedSegment = normalizeSegment(segment)

    if (isPlanSegment(normalizedSegment)) {
        if (normalizedSegment === 'all') {
            return fetchProfiles(adminSupabase, undefined, options?.requireEmail)
        }

        let query = adminSupabase
            .from('profiles')
            .select('id, email, full_name, plan')
            .eq('plan', normalizedSegment)

        if (options?.requireEmail) {
            query = query.not('email', 'is', null)
        }

        const { data, error } = await query
        if (error) throw error

        return (data || []) as BroadcastRecipientProfile[]
    }

    const targetStatus = AGENT_SEGMENT_TO_STATUS[normalizedSegment]
    const userIds = await getUserIdsForAgentStatus(adminSupabase, targetStatus)
    return fetchProfiles(adminSupabase, userIds, options?.requireEmail)
}

export async function getUserIdsForBroadcastSegment(adminSupabase: any, segment?: string | null): Promise<string[]> {
    const profiles = await getProfilesForBroadcastSegment(adminSupabase, segment)
    return profiles.map((profile) => profile.id).filter(Boolean)
}

export async function getEmailRecipientsForBroadcastSegment(adminSupabase: any, segment?: string | null) {
    return getProfilesForBroadcastSegment(adminSupabase, segment, { requireEmail: true })
}

type SupabaseClientLike = any

export type AutomatedDeletionReason = 'expired_test_account' | 'expired_paid_grace'
export type AutomatedDeletionResult = 'deleted' | 'skipped' | 'failed'

export type DeletionSnapshotCounts = {
    agents: number
    whatsapp_sessions: number
    conversations: number
    messages: number
    knowledge_base: number
    products: number
    subscriptions: number
    payments: number
    orders: number
}

export type DeletionSnapshot = {
    capturedAt: string
    relatedCounts: DeletionSnapshotCounts
}

function normalizeCount(value: unknown): number {
    const count = Number(value || 0)
    return Number.isFinite(count) ? count : 0
}

function summarizeLiveState(liveState: any = null) {
    if (!liveState) {
        return null
    }

    return {
        isTestAccount: liveState.isTestAccount ?? null,
        isExpired: liveState.isExpired ?? null,
        shouldDelete: liveState.shouldDelete ?? null,
        exitReason: liveState.exitReason ?? null,
        bannerMode: liveState.lifecycleAccess?.bannerMode ?? null,
        lifecycleStatus: liveState.lifecycleAccess?.lifecycle?.status ?? null,
        shouldDeleteAfterGrace: liveState.lifecycleAccess?.lifecycle?.shouldDeleteAfterGrace ?? null,
    }
}

async function countExactRows(
    supabase: SupabaseClientLike,
    table: string,
    applyFilters: (query: any) => any
): Promise<number> {
    let query = supabase
        .from(table)
        .select('id', { count: 'exact', head: true })

    query = applyFilters(query)

    const { count, error } = await query

    if (error) {
        throw error
    }

    return normalizeCount(count)
}

export async function captureSystemDeletionSnapshot(
    supabase: SupabaseClientLike,
    userId: string
): Promise<DeletionSnapshot> {
    const { data: agentRows, error: agentError } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)

    if (agentError) {
        throw agentError
    }

    const agentIds = (agentRows || [])
        .map((row: any) => String(row?.id || '').trim())
        .filter(Boolean)

    const [
        conversations,
        knowledgeBase,
        products,
        subscriptions,
        payments,
        orders,
        messages,
    ] = await Promise.all([
        countExactRows(supabase, 'conversations', (query) => query.eq('user_id', userId)),
        countExactRows(supabase, 'knowledge_base', (query) => query.eq('user_id', userId)),
        countExactRows(supabase, 'products', (query) => query.eq('user_id', userId)),
        countExactRows(supabase, 'subscriptions', (query) => query.eq('user_id', userId)),
        countExactRows(supabase, 'payments', (query) => query.eq('user_id', userId)),
        countExactRows(supabase, 'orders', (query) => query.eq('user_id', userId)),
        agentIds.length > 0
            ? countExactRows(supabase, 'messages', (query) => query.in('agent_id', agentIds))
            : Promise.resolve(0),
    ])

    return {
        capturedAt: new Date().toISOString(),
        relatedCounts: {
            agents: agentIds.length,
            whatsapp_sessions: 0,
            conversations,
            messages,
            knowledge_base: knowledgeBase,
            products,
            subscriptions,
            payments,
            orders,
        },
    }
}

export function allRelatedCountsAreZero(counts: Partial<DeletionSnapshotCounts> | null | undefined): boolean | null {
    if (!counts) {
        return null
    }

    return Object.values(counts).every((value) => normalizeCount(value) === 0)
}

export function buildSystemDeletionAuditEntry({
    profile,
    reason,
    result,
    liveState = null,
    beforeSnapshot,
    afterSnapshot = null,
    failureMessage = null,
    note = null,
}: {
    profile: any
    reason: AutomatedDeletionReason
    result: AutomatedDeletionResult
    liveState?: any
    beforeSnapshot: DeletionSnapshot
    afterSnapshot?: DeletionSnapshot | null
    failureMessage?: string | null
    note?: string | null
}) {
    return {
        user_id: profile?.id || null,
        email: profile?.email || null,
        full_name: profile?.full_name || null,
        plan: profile?.plan || null,
        role: profile?.role || null,
        deletion_reason: reason,
        deletion_result: result,
        failure_message: failureMessage,
        account_lifecycle_status: profile?.account_lifecycle_status || null,
        paid_until: profile?.paid_until || null,
        grace_until: profile?.grace_until || null,
        test_account_cleanup_deadline: profile?.test_account_cleanup_deadline || null,
        test_account_qualified_at: profile?.test_account_qualified_at || null,
        related_counts_before: beforeSnapshot.relatedCounts,
        related_counts_after: afterSnapshot?.relatedCounts || null,
        metadata: {
            source: 'system_cron',
            note,
            live_state: summarizeLiveState(liveState),
            before_snapshot_captured_at: beforeSnapshot.capturedAt,
            after_snapshot_captured_at: afterSnapshot?.capturedAt || null,
            cascade_cleanup_verified: allRelatedCountsAreZero(afterSnapshot?.relatedCounts),
        },
    }
}

export async function recordSystemDeletionAuditEntry(
    supabase: SupabaseClientLike,
    entry: ReturnType<typeof buildSystemDeletionAuditEntry>
) {
    const { error } = await supabase
        .from('system_deletion_audit_logs')
        .insert(entry)

    if (error) {
        throw error
    }
}

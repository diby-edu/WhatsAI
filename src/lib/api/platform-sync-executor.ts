import { decryptCredentials } from '@/lib/api/platform-sync-crypto'
import {
    fetchProviderProducts,
    type PlatformSyncCredentials,
    type PlatformSyncProvider,
    validatePlatformSyncCredentials,
} from '@/lib/api/platform-sync-providers'

interface SyncConnectionRow {
    id: string
    user_id: string
    agent_id: string
    provider: PlatformSyncProvider
    is_active: boolean
    auto_sync_enabled?: boolean | null
    sync_interval_minutes?: number | null
    retry_count?: number | null
    next_retry_at?: string | null
    last_synced_at?: string | null
    credentials_encrypted: unknown
}

interface ExecuteSyncOptions {
    triggerSource: 'manual' | 'cron'
    maxItems?: number
}

interface ExecuteSyncResult {
    ok: boolean
    synced: number
    fetched: number
    hasMore: boolean
    status: 'success' | 'failed'
    error: string | null
    startedAt: string
    finishedAt: string
}

function asNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value)
        if (Number.isFinite(parsed)) return parsed
    }
    return null
}

function computeBackoffMinutes(retryCount: number): number {
    const safeRetryCount = Math.max(1, Math.min(8, retryCount))
    const base = 5
    const value = base * Math.pow(2, safeRetryCount - 1)
    return Math.min(60, Math.max(5, Math.round(value)))
}

function toIso(input: Date): string {
    return input.toISOString()
}

function resolveMaxItems(input?: number | null): number {
    return Math.min(Math.max(input || 200, 1), 500)
}

function resolveIntervalMinutes(connection: SyncConnectionRow): number {
    const raw = asNumber(connection.sync_interval_minutes)
    return Math.min(Math.max(raw || 15, 5), 1440)
}

export function isConnectionDueForAutoSync(connection: SyncConnectionRow, nowMs = Date.now()): boolean {
    if (!connection.is_active) return false
    if (!connection.auto_sync_enabled) return false

    const nextRetryAt = String(connection.next_retry_at || '').trim()
    if (nextRetryAt) {
        const retryMs = new Date(nextRetryAt).getTime()
        if (Number.isFinite(retryMs) && retryMs > nowMs) {
            return false
        }
    }

    const lastSyncedAt = String(connection.last_synced_at || '').trim()
    if (!lastSyncedAt) return true

    const lastSyncedMs = new Date(lastSyncedAt).getTime()
    if (!Number.isFinite(lastSyncedMs)) return true

    const dueAfterMs = resolveIntervalMinutes(connection) * 60 * 1000
    return (nowMs - lastSyncedMs) >= dueAfterMs
}

export async function executePlatformSyncConnection(
    admin: any,
    connection: SyncConnectionRow,
    options: ExecuteSyncOptions
): Promise<ExecuteSyncResult> {
    const startedAtDate = new Date()
    const startedAt = toIso(startedAtDate)
    const maxItems = resolveMaxItems(options.maxItems)
    const shouldScheduleRetry = options.triggerSource === 'cron' || Boolean(connection.auto_sync_enabled)

    await admin
        .from('api_platform_sync_connections')
        .update({
            last_sync_status: 'running',
            last_sync_error: null,
            last_sync_started_at: startedAt,
        })
        .eq('id', connection.id)
        .eq('user_id', connection.user_id)

    let result: ExecuteSyncResult = {
        ok: false,
        synced: 0,
        fetched: 0,
        hasMore: false,
        status: 'failed',
        error: 'Unknown sync error',
        startedAt,
        finishedAt: startedAt,
    }

    try {
        const decrypted = decryptCredentials(connection.credentials_encrypted)
        const validated = validatePlatformSyncCredentials(connection.provider, decrypted)
        if (!validated.ok) {
            throw new Error(validated.error)
        }

        const fetched = await fetchProviderProducts(
            connection.provider,
            validated.credentials as PlatformSyncCredentials,
            maxItems
        )

        const nowIso = toIso(new Date())
        const rows = fetched.products.map(item => ({
            agent_id: connection.agent_id,
            user_id: connection.user_id,
            data_type: 'product',
            external_id: item.external_id,
            data: {
                ...item.data,
                provider: connection.provider,
                synced_at: nowIso,
            },
        }))

        if (rows.length > 0) {
            const { error: upsertError } = await admin
                .from('agent_external_data')
                .upsert(rows, { onConflict: 'agent_id,data_type,external_id' })

            if (upsertError) {
                throw new Error(`Failed to upsert agent_external_data: ${upsertError.message}`)
            }
        }

        // Remove products that are no longer in the provider (deleted, unpublished, filtered out)
        if (!fetched.hasMore) {
            const syncedIds = fetched.products.map(p => p.external_id)
            const deleteQuery = admin
                .from('agent_external_data')
                .delete()
                .eq('agent_id', connection.agent_id)
                .eq('user_id', connection.user_id)
                .eq('data_type', 'product')
            if (syncedIds.length > 0) {
                await deleteQuery.not('external_id', 'in', `(${syncedIds.join(',')})`)
            } else {
                await deleteQuery
            }
        }

        const finishedAt = toIso(new Date())
        await admin
            .from('api_platform_sync_connections')
            .update({
                last_synced_at: finishedAt,
                last_sync_status: 'success',
                last_sync_error: null,
                last_sync_count: rows.length,
                retry_count: 0,
                next_retry_at: null,
                last_sync_finished_at: finishedAt,
            })
            .eq('id', connection.id)
            .eq('user_id', connection.user_id)

        await admin
            .from('api_platform_sync_runs')
            .insert({
                connection_id: connection.id,
                user_id: connection.user_id,
                agent_id: connection.agent_id,
                trigger_source: options.triggerSource,
                status: 'success',
                fetched_count: fetched.fetched,
                synced_count: rows.length,
                has_more: fetched.hasMore,
                error: null,
                started_at: startedAt,
                finished_at: finishedAt,
            })

        result = {
            ok: true,
            synced: rows.length,
            fetched: fetched.fetched,
            hasMore: fetched.hasMore,
            status: 'success',
            error: null,
            startedAt,
            finishedAt,
        }
    } catch (error: any) {
        const message = error?.message || 'Sync failed'
        const nextRetryCount = shouldScheduleRetry
            ? Math.max(0, Number(connection.retry_count || 0)) + 1
            : 0
        const retryAfterMinutes = shouldScheduleRetry
            ? computeBackoffMinutes(nextRetryCount)
            : 0
        const nextRetryAt = shouldScheduleRetry
            ? toIso(new Date(Date.now() + retryAfterMinutes * 60 * 1000))
            : null
        const finishedAt = toIso(new Date())

        await admin
            .from('api_platform_sync_connections')
            .update({
                last_sync_status: 'failed',
                last_sync_error: message,
                retry_count: nextRetryCount,
                next_retry_at: nextRetryAt,
                last_sync_finished_at: finishedAt,
            })
            .eq('id', connection.id)
            .eq('user_id', connection.user_id)

        await admin
            .from('api_platform_sync_runs')
            .insert({
                connection_id: connection.id,
                user_id: connection.user_id,
                agent_id: connection.agent_id,
                trigger_source: options.triggerSource,
                status: 'failed',
                fetched_count: 0,
                synced_count: 0,
                has_more: false,
                error: message,
                started_at: startedAt,
                finished_at: finishedAt,
            })

        result = {
            ok: false,
            synced: 0,
            fetched: 0,
            hasMore: false,
            status: 'failed',
            error: message,
            startedAt,
            finishedAt,
        }
    }

    return result
}

import {
    executePlatformSyncConnection,
    isConnectionDueForAutoSync,
} from '@/lib/api/platform-sync-executor'
import { getAdminSupabase } from './shared'

/**
 * Auto-sync external catalogues (Woo/Shopify) for external_sync agents.
 * Runs every 5 minutes and retries failed syncs with backoff.
 */
// CRON-1 : verrou global léger anti-chevauchement, réutilise cron_run_logs
// (pas de nouvelle table). Si un run 'catalog_sync' a démarré il y a moins de
// 10 minutes (> l'intervalle */5) sans avoir encore écrit de statut final,
// on considère qu'il tourne toujours et on saute ce tick.
async function isCatalogSyncAlreadyRunning(supabase: ReturnType<typeof getAdminSupabase>): Promise<boolean> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: recentRuns, error } = await supabase
        .from('cron_run_logs')
        .select('status, started_at')
        .eq('task_key', 'catalog_sync')
        .gte('started_at', tenMinutesAgo)
        .order('started_at', { ascending: false })
        .limit(1)

    if (error || !recentRuns || recentRuns.length === 0) return false
    return recentRuns[0].status === 'running'
}

async function handlePlatformCatalogAutoSync(): Promise<void> {
    try {
        const supabase = getAdminSupabase()

        if (await isCatalogSyncAlreadyRunning(supabase)) {
            console.log('[CRON] Skipping platform catalogue auto-sync: previous run still in progress.')
            return
        }
        await supabase.from('cron_run_logs').insert({ task_key: 'catalog_sync', status: 'running', duration_ms: 0 })

        const { data: connections, error } = await supabase
            .from('api_platform_sync_connections')
            .select('id, user_id, agent_id, provider, is_active, auto_sync_enabled, sync_interval_minutes, retry_count, next_retry_at, last_synced_at, last_sync_status, last_sync_started_at, credentials_encrypted')
            .eq('is_active', true)
            .eq('auto_sync_enabled', true)
            .order('updated_at', { ascending: true })
            .limit(100)

        if ((error as any)?.code === '42P01' || (error as any)?.code === '42703') {
            console.log('[CRON] Skipping platform catalogue auto-sync: sync tables/columns not migrated yet.')
            return
        }

        if (error) {
            console.error('[CRON] Error fetching platform sync connections:', error)
            return
        }

        if (!connections || connections.length === 0) {
            return
        }

        const nowMs = Date.now()
        let scanned = 0
        let due = 0
        let success = 0
        let failed = 0
        let skippedRunning = 0

        for (const connection of connections as any[]) {
            scanned += 1

            const runningState = String(connection.last_sync_status || '').trim().toLowerCase()
            const startedAtRaw = String(connection.last_sync_started_at || '').trim()
            if (runningState === 'running' && startedAtRaw) {
                const startedAtMs = new Date(startedAtRaw).getTime()
                if (Number.isFinite(startedAtMs) && (nowMs - startedAtMs) < 15 * 60 * 1000) {
                    skippedRunning += 1
                    continue
                }
            }

            if (!isConnectionDueForAutoSync(connection, nowMs)) {
                continue
            }

            due += 1
            const result = await executePlatformSyncConnection(supabase, connection, {
                triggerSource: 'cron',
                maxItems: 200,
            })

            if (result.ok) success += 1
            else failed += 1
        }

        if (due > 0 || failed > 0 || skippedRunning > 0) {
            console.log(
                `[CRON] Platform catalogue auto-sync: scanned=${scanned}, due=${due}, success=${success}, failed=${failed}, skipped_running=${skippedRunning}`
            )
        }
    } catch (error) {
        console.error('[CRON] Error in platform catalogue auto-sync:', error)
    }
}

// =============================================

export {
    handlePlatformCatalogAutoSync,
}

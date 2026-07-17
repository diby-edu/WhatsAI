import { notify } from '../notification.service'
import {
    fetchUserTestAccountState,
    listUsersWithExpiredPaidGraceWindow,
    listUsersWithExpiredTestCleanupDeadline,
} from '@/lib/test-account'
import {
    buildSystemDeletionAuditEntry,
    captureSystemDeletionSnapshot,
    recordSystemDeletionAuditEntry,
} from '@/lib/notifications/system-deletion-audit'
import { getAdminSupabase, toErrorMessage, buildEmptyDeletionSnapshot, persistSystemDeletionAudit } from './shared'

/**
 * Manage the lifecycle of deactivated agents:
 * - Send a warning at J+4 (3 days before deletion)
 * - Auto-delete agents deactivated for 7+ days
 */
async function handleArchivedAgentLifecycle(): Promise<void> {
    console.log('⏰ [CRON] Handling deactivated agent lifecycle...')
    try {
        const supabase = getAdminSupabase()
        const now = new Date()

        // Warning: deactivated 3-5 days ago (warn once around J+4, 3 days left)
        const day3 = new Date(now.getTime() - 3 * 24 * 3600000)
        const day5 = new Date(now.getTime() - 5 * 24 * 3600000)
        const { data: warningAgents } = await supabase
            .from('agents')
            .select('user_id, name')
            .not('archived_at', 'is', null)
            .lte('archived_at', day3.toISOString())
            .gte('archived_at', day5.toISOString())

        if (warningAgents && warningAgents.length > 0) {
            const userMap = new Map<string, string[]>()
            for (const a of warningAgents) {
                const list = userMap.get(a.user_id) || []
                list.push(a.name)
                userMap.set(a.user_id, list)
            }
            for (const [userId] of userMap) {
                await notify(userId, 'agent_delete_warning', {})
            }
            console.log(`⏰ [CRON] Sent delete warnings (3 days left) for ${userMap.size} user(s)`)
        }

        // Auto-delete agents deactivated 7+ days ago
        // Exception : exclure les agents des comptes en frozen_grace (grace 30j — l'utilisateur
        // peut encore renouveler et récupérer ses agents via reactivateArchivedAgentsForPlan)
        const day7Delete = new Date(now.getTime() - 7 * 24 * 3600000)

        const { data: agentCandidates } = await supabase
            .from('agents')
            .select('id, user_id')
            .not('archived_at', 'is', null)
            .lte('archived_at', day7Delete.toISOString())

        if (agentCandidates && agentCandidates.length > 0) {
            const candidateUserIds = [...new Set(agentCandidates.map((a: any) => a.user_id))]

            const { data: frozenUsers } = await supabase
                .from('profiles')
                .select('id')
                .in('id', candidateUserIds)
                .eq('account_lifecycle_status', 'frozen_grace')

            const frozenUserIdSet = new Set((frozenUsers || []).map((u: any) => u.id))
            const toDelete = agentCandidates
                .filter((a: any) => !frozenUserIdSet.has(a.user_id))
                .map((a: any) => a.id)

            if (toDelete.length > 0) {
                const { error } = await supabase
                    .from('agents')
                    .delete()
                    .in('id', toDelete)

                if (!error) {
                    console.log(`⏰ [CRON] Auto-deleted ${toDelete.length} deactivated agent(s) (${frozenUserIdSet.size} user(s) in frozen_grace protected)`)
                }
            } else if (frozenUserIdSet.size > 0) {
                console.log(`⏰ [CRON] No agents deleted — all ${frozenUserIdSet.size} user(s) in frozen_grace`)
            }
        }
    } catch (error) {
        console.error('⏰ [CRON] Error in deactivated agent lifecycle:', error)
    }
}

/**
 * Handle credit expiry:
 * - Send a warning at J+4 (~3 days before expiry)
 * - Zero out credits that have passed their expiry date (7 days total)
 */

async function handlePaidAccountCleanup(): Promise<void> {
    console.log('[CRON] Handling expired paid-account cleanup...')

    try {
        const supabase = getAdminSupabase()
        const nowMs = Date.now()
        const expiredProfiles = await listUsersWithExpiredPaidGraceWindow(supabase, nowMs)

        if (!expiredProfiles.length) {
            console.log('[CRON] No expired paid accounts to delete.')
            return
        }

        let deleted = 0
        let skipped = 0
        let failed = 0

        for (const profile of expiredProfiles) {
            let beforeSnapshot = null
            try {
                beforeSnapshot = await captureSystemDeletionSnapshot(supabase, profile.id)
                const liveState = await fetchUserTestAccountState(supabase, profile.id, nowMs)

                if (!liveState?.lifecycleAccess?.lifecycle?.shouldDeleteAfterGrace) {
                    skipped += 1
                    console.log(`[CRON] Skip paid-account cleanup for ${profile.email || profile.id} - lifecycle changed before deletion`)
                    await persistSystemDeletionAudit(supabase, {
                        profile,
                        reason: 'expired_paid_grace',
                        result: 'skipped',
                        liveState,
                        beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                        note: 'lifecycle_changed_before_deletion',
                    })
                    continue
                }

                const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id)

                if (deleteError) {
                    failed += 1
                    console.error(`[CRON] Failed to delete expired paid account ${profile.email || profile.id}:`, deleteError.message)
                    // Clear grace_until to stop infinite retry loop — requires manual admin intervention
                    await supabase.from('profiles').update({ grace_until: null }).eq('id', profile.id)
                    console.warn(`[CRON] grace_until cleared for ${profile.email || profile.id} — manual deletion required`)
                    await persistSystemDeletionAudit(supabase, {
                        profile,
                        reason: 'expired_paid_grace',
                        result: 'failed',
                        liveState,
                        beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                        failureMessage: deleteError.message,
                        note: 'auth_delete_failed_grace_cleared',
                    })
                    continue
                }

                const afterSnapshot = await captureSystemDeletionSnapshot(supabase, profile.id)
                deleted += 1
                console.log(`[CRON] Deleted expired paid account ${profile.email || profile.id}`)
                await persistSystemDeletionAudit(supabase, {
                    profile,
                    reason: 'expired_paid_grace',
                    result: 'deleted',
                    liveState,
                    beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                    afterSnapshot,
                    note: 'deleted_by_cron',
                })
            } catch (profileError) {
                failed += 1
                console.error(`[CRON] Error while processing expired paid account ${profile.email || profile.id}:`, profileError)
                await persistSystemDeletionAudit(supabase, {
                    profile,
                    reason: 'expired_paid_grace',
                    result: 'failed',
                    beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                    failureMessage: toErrorMessage(profileError),
                    note: 'unexpected_cleanup_error',
                })
            }
        }

        console.log(`[CRON] Paid-account cleanup finished - deleted=${deleted}, skipped=${skipped}, failed=${failed}`)
    } catch (error) {
        console.error('[CRON] Error in paid-account cleanup:', error)
    }
}

/**
 * Delete only genuinely expired test accounts.
 * Safety rules:
 * - deadline must be expired
 * - user must still match the test-account criteria at deletion time
 * - protected roles are skipped
 */
async function handleTestAccountCleanup(): Promise<void> {
    console.log('⏰ [CRON] Handling expired test-account cleanup...')

    try {
        const supabase = getAdminSupabase()
        const nowMs = Date.now()
        const expiredProfiles = await listUsersWithExpiredTestCleanupDeadline(supabase, nowMs)

        if (!expiredProfiles.length) {
            console.log('⏰ [CRON] No expired test accounts to delete.')
            return
        }

        let deleted = 0
        let skipped = 0
        let failed = 0

        for (const profile of expiredProfiles) {
            let beforeSnapshot = null
            try {
                beforeSnapshot = await captureSystemDeletionSnapshot(supabase, profile.id)
                const liveState = await fetchUserTestAccountState(supabase, profile.id, nowMs)

                if (!liveState?.shouldDelete) {
                    skipped += 1
                    console.log(`⏭️ [CRON] Skip test-account cleanup for ${profile.email || profile.id} — user no longer qualifies`)
                    await persistSystemDeletionAudit(supabase, {
                        profile,
                        reason: 'expired_test_account',
                        result: 'skipped',
                        liveState,
                        beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                        note: 'user_no_longer_qualifies',
                    })
                    continue
                }

                // Grace 30j si l'utilisateur a acheté des crédits sans souscrire
                // Ne s'applique qu'une seule fois :
                // - pas déjà en frozen_grace
                // - n'a pas déjà eu une grace_until (même expirée) — évite la boucle si handleCreditExpiry
                //   a déjà remis account_lifecycle_status à 'inactive' après expiration de la grace
                const alreadyInGrace = String((liveState as any)?.profile?.account_lifecycle_status || '').trim() === 'frozen_grace'
                const hadGracePeriod = Boolean((liveState as any)?.profile?.grace_until)
                if (!alreadyInGrace && !hadGracePeriod) {
                    const { count: creditPaymentsCount } = await supabase
                        .from('payments')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', profile.id)
                        .eq('status', 'completed')
                        .eq('payment_type', 'credits')

                    if (creditPaymentsCount && creditPaymentsCount > 0) {
                        const graceUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
                        await supabase
                            .from('profiles')
                            .update({
                                grace_until: graceUntil,
                                credits_frozen_at: new Date().toISOString(),
                                credits_expire_at: graceUntil,
                                account_lifecycle_status: 'frozen_grace',
                                // Replanifie le prochain passage du cron à la fin de la grace
                                test_account_cleanup_deadline: graceUntil,
                            })
                            .eq('id', profile.id)

                        // Archiver les agents
                        await supabase
                            .from('agents')
                            .update({ is_active: false, archived_at: new Date().toISOString() })
                            .eq('user_id', profile.id)
                            .eq('is_active', true)

                        skipped += 1
                        console.log(`⏸️ [CRON] Test account ${profile.email || profile.id} has credits — entering frozen_grace until ${graceUntil}`)
                        await persistSystemDeletionAudit(supabase, {
                            profile,
                            reason: 'expired_test_account',
                            result: 'skipped',
                            liveState,
                            beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                            note: 'test_expired_with_credits_grace',
                        })
                        continue
                    }
                }

                const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id)

                if (deleteError) {
                    failed += 1
                    console.error(`❌ [CRON] Failed to delete expired test account ${profile.email || profile.id}:`, deleteError.message)
                    await persistSystemDeletionAudit(supabase, {
                        profile,
                        reason: 'expired_test_account',
                        result: 'failed',
                        liveState,
                        beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                        failureMessage: deleteError.message,
                        note: 'auth_delete_failed',
                    })
                    continue
                }

                const afterSnapshot = await captureSystemDeletionSnapshot(supabase, profile.id)
                deleted += 1
                console.log(`🗑️ [CRON] Deleted expired test account ${profile.email || profile.id}`)
                await persistSystemDeletionAudit(supabase, {
                    profile,
                    reason: 'expired_test_account',
                    result: 'deleted',
                    liveState,
                    beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                    afterSnapshot,
                    note: 'deleted_by_cron',
                })
            } catch (userError) {
                failed += 1
                console.error(`❌ [CRON] Error while processing expired test account ${profile.email || profile.id}:`, userError)
                await persistSystemDeletionAudit(supabase, {
                    profile,
                    reason: 'expired_test_account',
                    result: 'failed',
                    beforeSnapshot: beforeSnapshot || buildEmptyDeletionSnapshot(),
                    failureMessage: toErrorMessage(userError),
                    note: 'unexpected_cleanup_error',
                })
            }
        }

        console.log(`⏰ [CRON] Test-account cleanup finished — deleted=${deleted}, skipped=${skipped}, failed=${failed}`)
    } catch (error) {
        console.error('⏰ [CRON] Error in test-account cleanup:', error)
    }
}

export {
    handleArchivedAgentLifecycle,
    handlePaidAccountCleanup,
    handleTestAccountCleanup,
}

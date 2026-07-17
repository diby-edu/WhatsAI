import { notify } from '../notification.service'
import { buildAgentDeactivationUpdate } from '@/lib/whatsapp/agent-lifecycle'
import { getAdminSupabase, freezePaidLifecycleForUser, updateProfileFreezeState } from './shared'

/**
 * Check for expiring subscriptions and notify users.
 * Runs daily at 8:00 AM (Africa/Abidjan timezone).
 */
async function checkExpiringSubscriptions(): Promise<void> {
    console.log('⏰ [CRON] Checking expiring subscriptions...')

    try {
        const supabase = getAdminSupabase()

        // Find subscriptions expiring in 7 days
        const now = new Date()
        const in7Days = new Date(now)
        in7Days.setDate(in7Days.getDate() + 7)

        // Window: expire between now and 7 days from now
        // Schema-safe: prefer "plan" (current schema), fallback to legacy "plan_id".
        let subscriptions: any[] | null = null
        let error: any = null

        const primaryQuery = await supabase
            .from('subscriptions')
            .select('user_id, plan, current_period_end, status')
            .eq('status', 'active')
            .gte('current_period_end', now.toISOString())
            .lte('current_period_end', in7Days.toISOString())

        if (primaryQuery.error?.code === '42703') {
            const legacyQuery = await supabase
                .from('subscriptions')
                .select('user_id, plan_id, current_period_end, status')
                .eq('status', 'active')
                .gte('current_period_end', now.toISOString())
                .lte('current_period_end', in7Days.toISOString())
            subscriptions = legacyQuery.data
            error = legacyQuery.error
        } else {
            subscriptions = primaryQuery.data
            error = primaryQuery.error
        }

        if (error) {
            console.error('⏰ [CRON] Error fetching subscriptions:', error)
            return
        }

        if (!subscriptions || subscriptions.length === 0) {
            console.log('⏰ [CRON] No expiring subscriptions found.')
            return
        }

        console.log(`⏰ [CRON] Found ${subscriptions.length} expiring subscription(s)`)

        // Check which users were already notified today to avoid duplicates
        const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

        for (const sub of subscriptions) {
            try {
                // Anti-duplicate: check if we already notified this user today
                const { data: existingNotif } = await supabase
                    .from('notification_log')
                    .select('id')
                    .eq('user_id', sub.user_id)
                    .eq('type', 'subscription_expiring')
                    .gte('created_at', `${today}T00:00:00Z`)
                    .single()

                if (existingNotif) {
                    console.log(`⏰ [CRON] User ${sub.user_id} already notified today, skipping.`)
                    continue
                }

                // Calculate days left
                const expiryDate = new Date(sub.current_period_end)
                const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

                // Format date for display
                const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                })

                // Send notification (push + email)
                const planName = String((sub as any).plan || (sub as any).plan_id || 'WazzapAI')

                await notify(sub.user_id, 'subscription_expiring', {
                    planName,
                    daysLeft,
                    expiryDate: formattedDate
                })

                // Log that we notified this user
                await supabase
                    .from('notification_log')
                    .insert({
                        user_id: sub.user_id,
                        type: 'subscription_expiring',
                        data: {
                            plan: (sub as any).plan || null,
                            plan_id: (sub as any).plan_id || null,
                            days_left: daysLeft
                        }
                    })

                console.log(`⏰ [CRON] Notified user ${sub.user_id} — ${daysLeft} days left`)

            } catch (userError) {
                console.error(`⏰ [CRON] Error notifying user ${sub.user_id}:`, userError)
                // Continue to next user
            }
        }

        console.log('⏰ [CRON] Subscription check completed.')

    } catch (error) {
        console.error('⏰ [CRON] Fatal error in subscription check:', error)
    }
}

/**
 * Detect expired subscriptions and downgrade plan to Free.
 * Runs daily at 8:00 AM alongside checkExpiringSubscriptions().
 * Credits are preserved — the user keeps what they paid for.
 */
async function checkExpiredSubscriptions(): Promise<void> {
    console.log('⏰ [CRON] Checking expired subscriptions...')

    try {
        const supabase = getAdminSupabase()
        const now = new Date().toISOString()

        // Subscriptions past their end date that are still marked 'active'
        const { data: expired, error } = await supabase
            .from('subscriptions')
            .select('id, user_id, plan, current_period_end')
            .eq('status', 'active')
            .lt('current_period_end', now)

        if (error) {
            console.error('⏰ [CRON] Error fetching expired subscriptions:', error)
            return
        }

        if (!expired || expired.length === 0) {
            console.log('⏰ [CRON] No expired subscriptions found.')
            return
        }

        console.log(`⏰ [CRON] Found ${expired.length} expired subscription(s)`)

        for (const sub of expired) {
            try {
                // 1. Mark subscription as expired
                await supabase
                    .from('subscriptions')
                    .update({ status: 'expired' })
                    .eq('id', sub.id)

                const lifecycleFreezeResult = await freezePaidLifecycleForUser(
                    supabase,
                    sub.user_id,
                    (sub as any).current_period_end || null
                )

                console.log(
                    `â° [CRON] Expired: user ${sub.user_id} (was: ${sub.plan}) â†’ frozen_grace until ${new Date(lifecycleFreezeResult.graceUntil).toLocaleDateString('fr-FR')}`
                )
                if (lifecycleFreezeResult.graceUntil) {
                    continue
                }

                // 2. Downgrade profile to free + freeze credits
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits_balance')
                    .eq('id', sub.user_id)
                    .single()

                const currentBalance = Number(profile?.credits_balance) || 0
                const freezeDate = new Date()
                const expireDate = new Date(freezeDate.getTime() + 7 * 24 * 3600000) // 7 jours de grâce universelle

                await supabase
                    .from('profiles')
                    .update({
                        plan: 'free',
                        credits_frozen_at: freezeDate.toISOString(),
                        credits_expire_at: expireDate.toISOString(),
                    })
                    .eq('id', sub.user_id)

                // Notify user: credits frozen
                if (currentBalance > 0) {
                    await notify(sub.user_id, 'credits_freeze_warning', {
                        balance: currentBalance,
                        creditExpireDate: expireDate.toLocaleDateString('fr-FR')
                    })
                }

                // 3. Désactiver TOUS les agents (pas seulement l'excédent)
                const { data: userAgents } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('user_id', sub.user_id)
                    .is('archived_at', null)

                if (userAgents && userAgents.length > 0) {
                    const toDeactivate = userAgents.map((a: any) => a.id)
                    await supabase
                        .from('agents')
                        .update({
                            archived_at: freezeDate.toISOString(),
                            archived_reason: 'subscription_expired',
                            ...buildAgentDeactivationUpdate(),
                        })
                        .in('id', toDeactivate)

                    await notify(sub.user_id, 'agent_archived', {
                        count: toDeactivate.length,
                        deleteDate: expireDate.toLocaleDateString('fr-FR')
                    })
                }

                console.log(`⏰ [CRON] Expired: user ${sub.user_id} (was: ${sub.plan}) → free | credits frozen until ${expireDate.toLocaleDateString('fr-FR')}`)
            } catch (subErr) {
                console.error(`⏰ [CRON] Error processing expired sub for user ${sub.user_id}:`, subErr)
            }
        }

        console.log('⏰ [CRON] Expired subscription check completed.')
    } catch (error) {
        console.error('⏰ [CRON] Fatal error in expired subscription check:', error)
    }
}

async function checkExpiredPaidAccounts(): Promise<void> {
    console.log('â° [CRON] Reconciling expired paid windows...')

    try {
        const supabase = getAdminSupabase()
        const now = new Date()
        const nowIso = now.toISOString()
        const nowMs = now.getTime()

        const { data: profiles, error } = await supabase
            .from('profiles')
            .select('id, paid_until, grace_until, account_lifecycle_status')
            .not('paid_until', 'is', null)
            .lt('paid_until', nowIso)

        if ((error as any)?.code === '42703') {
            console.log('â° [CRON] Skipping paid-window reconciliation: lifecycle columns not available yet.')
            return
        }

        if (error) {
            console.error('â° [CRON] Error fetching expired paid profiles:', error)
            return
        }

        if (!profiles || profiles.length === 0) {
            console.log('â° [CRON] No expired paid windows to reconcile.')
            return
        }

        let frozenCount = 0
        let inactiveCount = 0
        let skippedCount = 0

        for (const profile of profiles) {
            try {
                const profileId = String((profile as any).id || '').trim()
                const paidUntil = String((profile as any).paid_until || '').trim()
                const graceUntil = String((profile as any).grace_until || '').trim()
                const graceUntilMs = graceUntil ? new Date(graceUntil).getTime() : Number.NaN

                const { data: activeSubscription } = await supabase
                    .from('subscriptions')
                    .select('id')
                    .eq('user_id', profileId)
                    .eq('status', 'active')
                    .gte('current_period_end', nowIso)
                    .maybeSingle()

                if (activeSubscription) {
                    skippedCount += 1
                    continue
                }

                if (Number.isFinite(graceUntilMs) && graceUntilMs > nowMs) {
                    skippedCount += 1
                    continue
                }

                if (Number.isFinite(graceUntilMs) && graceUntilMs <= nowMs) {
                    const inactiveError = await updateProfileFreezeState(supabase, profileId, {
                        account_lifecycle_status: 'inactive',
                    })

                    if (inactiveError) {
                        throw inactiveError
                    }

                    inactiveCount += 1
                    continue
                }

                await freezePaidLifecycleForUser(supabase, profileId, paidUntil || null)
                frozenCount += 1
            } catch (profileError) {
                console.error(`â° [CRON] Error reconciling paid lifecycle for user ${(profile as any).id}:`, profileError)
            }
        }

        console.log(`â° [CRON] Paid-window reconciliation completed â€” frozen=${frozenCount}, inactive=${inactiveCount}, skipped=${skippedCount}`)
    } catch (error) {
        console.error('â° [CRON] Fatal error while reconciling paid windows:', error)
    }
}

/**
 * Send daily summary email to users who have it enabled.
 * Queries stats from the last 24 hours: conversations, orders, bookings, revenue, credits used.
 */

export {
    checkExpiringSubscriptions,
    checkExpiredSubscriptions,
    checkExpiredPaidAccounts,
}

import { notify } from '../notification.service'
import { getAdminSupabase, updateProfileFreezeState } from './shared'

/**
 * Handle credit expiry:
 * - Send a warning at J+4 (~3 days before expiry)
 * - Zero out credits that have passed their expiry date (7 days total)
 */
async function handleCreditExpiry(): Promise<void> {
    console.log('⏰ [CRON] Handling credit expiry...')
    try {
        const supabase = getAdminSupabase()
        const now = new Date()
        const in3Days = new Date(now.getTime() + 3 * 24 * 3600000)
        const in2Days = new Date(now.getTime() + 2 * 24 * 3600000)

        const { data: upcomingExpiryProfiles } = await supabase
            .from('profiles')
            .select('id, credits_balance, credits_expire_at')
            .not('credits_expire_at', 'is', null)
            .lte('credits_expire_at', in3Days.toISOString())
            .gte('credits_expire_at', in2Days.toISOString())
            .gt('credits_balance', 0)

        for (const user of upcomingExpiryProfiles || []) {
            const expireDate = new Date(user.credits_expire_at).toLocaleDateString('fr-FR')
            await notify(user.id, 'credits_freeze_warning', {
                balance: user.credits_balance,
                creditExpireDate: expireDate
            })
        }
        if ((upcomingExpiryProfiles || []).length > 0) {
            console.log(`â° [CRON] Credit expiry warnings (3 days left) sent to ${upcomingExpiryProfiles!.length} user(s)`)
        }

        const expiredProfilesQuery = await supabase
            .from('profiles')
            .select('id, credits_balance')
            .not('credits_expire_at', 'is', null)
            .lt('credits_expire_at', now.toISOString())

        for (const user of expiredProfilesQuery.data || []) {
            const updatePayload: Record<string, unknown> = {
                credits_frozen_at: null,
                credits_expire_at: null,
                account_lifecycle_status: 'inactive',
            }

            if (Number(user.credits_balance || 0) > 0) {
                updatePayload.credits_balance = 0
            }

            const updateError = await updateProfileFreezeState(supabase, user.id, updatePayload)
            if (updateError) {
                throw updateError
            }

            if (Number(user.credits_balance || 0) > 0) {
                await notify(user.id, 'credits_expired', {})
            }
        }
        if ((expiredProfilesQuery.data || []).length > 0) {
            console.log(`â° [CRON] Credits expired for ${expiredProfilesQuery.data!.length} user(s)`)
        }
        if (Array.isArray(expiredProfilesQuery.data)) {
            return
        }

        // Warning: credits expire in ~3 days (at J+4 of the 7-day grace period)
        const { data: warnUsers } = await supabase
            .from('profiles')
            .select('id, credits_balance, credits_expire_at')
            .not('credits_expire_at', 'is', null)
            .lte('credits_expire_at', in3Days.toISOString())
            .gte('credits_expire_at', in2Days.toISOString())
            .gt('credits_balance', 0)

        for (const user of warnUsers || []) {
            const expireDate = new Date(user.credits_expire_at).toLocaleDateString('fr-FR')
            await notify(user.id, 'credits_freeze_warning', {
                balance: user.credits_balance,
                creditExpireDate: expireDate
            })
        }
        if ((warnUsers || []).length > 0) {
            console.log(`⏰ [CRON] Credit expiry warnings (3 days left) sent to ${warnUsers!.length} user(s)`)
        }

        // Expire credits past their expiry date
        const { data: expired } = await supabase
            .from('profiles')
            .select('id, credits_balance')
            .not('credits_expire_at', 'is', null)
            .lt('credits_expire_at', now.toISOString())
            .gt('credits_balance', 0)

        for (const user of expired || []) {
            await supabase
                .from('profiles')
                .update({ credits_balance: 0, credits_frozen_at: null, credits_expire_at: null })
                .eq('id', user.id)
            await notify(user.id, 'credits_expired', {})
        }
        if ((expired || []).length > 0) {
            console.log(`⏰ [CRON] Credits expired for ${expired!.length} user(s)`)
        }
    } catch (error) {
        console.error('⏰ [CRON] Error in credit expiry:', error)
    }
}

/**
 * Alert users who have consumed 85%+ of their monthly credits.
 * Sends once per billing period (tracked via credits_high_usage_notified_at).
 */
async function checkHighCreditUsage(): Promise<void> {
    console.log('⏰ [CRON] Checking high credit usage...')
    try {
        const supabase = getAdminSupabase()

        // Get active subscriptions with credits_included
        const { data: activeSubs } = await supabase
            .from('subscriptions')
            .select('user_id, credits_included, current_period_start')
            .eq('status', 'active')
            .gte('current_period_end', new Date().toISOString())

        for (const sub of activeSubs || []) {
            if (!sub.credits_included || sub.credits_included <= 0) continue

            const { data: profile } = await supabase
                .from('profiles')
                .select('credits_used_this_month, credits_high_usage_notified_at, plan')
                .eq('id', sub.user_id)
                .single()

            if (!profile) continue

            const pct = Math.round((profile.credits_used_this_month / sub.credits_included) * 100)
            if (pct < 85) continue

            // Only send once per billing period
            const alreadyNotified = profile.credits_high_usage_notified_at &&
                new Date(profile.credits_high_usage_notified_at) >= new Date(sub.current_period_start)

            if (alreadyNotified) continue

            // Skip Scale plan (unlimited feel — no need to push upgrade)
            if (profile.plan === 'scale') continue

            await notify(sub.user_id, 'credit_usage_high', { usagePct: pct })
            await supabase
                .from('profiles')
                .update({ credits_high_usage_notified_at: new Date().toISOString() })
                .eq('id', sub.user_id)

            console.log(`⏰ [CRON] 85% alert sent to user ${sub.user_id} (${pct}%)`)
        }
    } catch (error) {
        console.error('⏰ [CRON] Error in high credit usage check:', error)
    }
}


export {
    handleCreditExpiry,
    checkHighCreditUsage,
}

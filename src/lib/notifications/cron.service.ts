import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { notify } from './notification.service'

// =============================================
// Cron Service - Scheduled tasks (runs in PM2 process)
// =============================================

let cronInitialized = false

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

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
        const { data: subscriptions, error } = await supabase
            .from('subscriptions')
            .select('user_id, plan_id, current_period_end, status')
            .eq('status', 'active')
            .gte('current_period_end', now.toISOString())
            .lte('current_period_end', in7Days.toISOString())

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
                await notify(sub.user_id, 'subscription_expiring', {
                    planName: sub.plan_id || 'WazzapAI',
                    daysLeft,
                    expiryDate: formattedDate
                })

                // Log that we notified this user
                await supabase
                    .from('notification_log')
                    .insert({
                        user_id: sub.user_id,
                        type: 'subscription_expiring',
                        data: { plan_id: sub.plan_id, days_left: daysLeft }
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
 * Initialize all cron jobs.
 * Should be called once at app startup.
 * Safe to call multiple times (idempotent).
 */
export function initCronJobs(): void {
    if (cronInitialized) {
        console.log('⏰ [CRON] Already initialized, skipping.')
        return
    }

    // Only run cron in production to avoid duplicate executions in dev (hot reload)
    if (process.env.NODE_ENV !== 'production') {
        console.log('⏰ [CRON] Skipping cron init in development mode.')
        return
    }

    // Schedule: every day at 8:00 AM UTC (= 8:00 AM in Abidjan / UTC+0)
    cron.schedule('0 8 * * *', () => {
        checkExpiringSubscriptions()
    }, {
        timezone: 'UTC'
    })

    cronInitialized = true
    console.log('⏰ [CRON] Cron jobs initialized — subscription check at 8:00 AM daily')
}

// Also export the check function for manual testing
export { checkExpiringSubscriptions }

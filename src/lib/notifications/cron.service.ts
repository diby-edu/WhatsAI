import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { notify } from './notification.service'
import { notifyAdmins } from './admin-notify'
import nodemailer from 'nodemailer'

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

function getMailTransporter() {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'mail.wazzapai.com',
        port: parseInt(process.env.SMTP_PORT || '465'),
        secure: true,
        auth: {
            user: process.env.SMTP_USER || process.env.SMTP_FROM,
            pass: process.env.SMTP_PASSWORD
        }
    })
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'

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
            .select('id, user_id, plan')
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

                // 2. Downgrade profile to free (credits_balance unchanged — user keeps remaining credits)
                await supabase
                    .from('profiles')
                    .update({ plan: 'free' })
                    .eq('id', sub.user_id)

                console.log(`⏰ [CRON] Expired: user ${sub.user_id} (was: ${sub.plan}) → free`)
            } catch (subErr) {
                console.error(`⏰ [CRON] Error processing expired sub for user ${sub.user_id}:`, subErr)
            }
        }

        console.log('⏰ [CRON] Expired subscription check completed.')
    } catch (error) {
        console.error('⏰ [CRON] Fatal error in expired subscription check:', error)
    }
}

/**
 * Send daily summary email to users who have it enabled.
 * Queries stats from the last 24 hours: conversations, orders, bookings, revenue, credits used.
 */
async function sendDailySummary(): Promise<void> {
    console.log('📊 [CRON] Starting daily summary emails...')

    try {
        const supabase = getAdminSupabase()

        // Get all users who have daily summary enabled
        const { data: prefs, error: prefsError } = await supabase
            .from('notification_preferences')
            .select('user_id')
            .eq('email_daily_summary', true)

        if (prefsError || !prefs || prefs.length === 0) {
            console.log('📊 [CRON] No users with daily summary enabled.')
            return
        }

        console.log(`📊 [CRON] Sending daily summary to ${prefs.length} user(s)`)

        const now = new Date()
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const since = yesterday.toISOString()

        const transporter = getMailTransporter()
        const fromEmail = process.env.SMTP_FROM || 'noreply@wazzapai.com'

        for (const pref of prefs) {
            try {
                const userId = pref.user_id

                // Get user profile
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', userId)
                    .single()

                if (!profile?.email) continue

                const userName = profile.full_name || 'Utilisateur'

                // Get user's agents
                const { data: agents } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('user_id', userId)

                const agentIds = agents?.map(a => a.id) || []

                if (agentIds.length === 0) continue // No agents = no activity

                // --- Query stats (last 24h) ---

                // 1. New conversations
                const { count: newConversations } = await supabase
                    .from('conversations')
                    .select('id', { count: 'exact', head: true })
                    .in('agent_id', agentIds)
                    .gte('created_at', since)

                // 2. Total messages received
                const { count: messagesReceived } = await supabase
                    .from('messages')
                    .select('id', { count: 'exact', head: true })
                    .in('agent_id', agentIds)
                    .eq('role', 'user')
                    .gte('created_at', since)

                // 3. New orders
                const { count: newOrders } = await supabase
                    .from('orders')
                    .select('id', { count: 'exact', head: true })
                    .in('agent_id', agentIds)
                    .gte('created_at', since)

                // 4. Paid orders & revenue
                const { data: paidOrders } = await supabase
                    .from('orders')
                    .select('total_fcfa')
                    .in('agent_id', agentIds)
                    .eq('status', 'paid')
                    .gte('updated_at', since)

                const revenue = paidOrders?.reduce((sum, o) => sum + Number(o.total_fcfa || 0), 0) || 0

                // 5. New bookings
                const { count: newBookings } = await supabase
                    .from('bookings')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                    .gte('created_at', since)

                // 6. Credits used (from credit_transactions)
                const { data: creditTx } = await supabase
                    .from('credit_transactions')
                    .select('amount')
                    .eq('user_id', userId)
                    .eq('type', 'usage')
                    .gte('created_at', since)

                const creditsUsed = creditTx?.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0) || 0

                // Skip if zero activity
                if ((newConversations || 0) === 0 && (messagesReceived || 0) === 0 && (newOrders || 0) === 0 && revenue === 0 && (newBookings || 0) === 0 && creditsUsed === 0) {
                    console.log(`📊 [CRON] User ${userId}: no activity, skipping.`)
                    continue
                }

                // --- Build email ---
                const dateStr = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

                const statRow = (emoji: string, label: string, value: string | number) =>
                    `<tr>
                        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(148,163,184,0.1);">
                            <span style="font-size: 18px; margin-right: 8px;">${emoji}</span>
                            <span style="color: #cbd5e1; font-size: 14px;">${label}</span>
                        </td>
                        <td style="padding: 12px 16px; border-bottom: 1px solid rgba(148,163,184,0.1); text-align: right; font-weight: 700; color: #f1f5f9; font-size: 16px;">
                            ${value}
                        </td>
                    </tr>`

                const emailHtml = `
                    <!DOCTYPE html>
                    <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
                    <body style="margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                        <div style="max-width: 520px; margin: 0 auto; padding: 32px 16px;">
                            <div style="text-align: center; margin-bottom: 24px;">
                                <h1 style="color: #f1f5f9; font-size: 24px; margin: 0 0 4px 0;">📊 Résumé du jour</h1>
                                <p style="color: #64748b; font-size: 13px; margin: 0;">${dateStr}</p>
                            </div>

                            <div style="background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(148, 163, 184, 0.1); border-radius: 16px; overflow: hidden; margin-bottom: 24px;">
                                <div style="padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1)); border-bottom: 1px solid rgba(148,163,184,0.1);">
                                    <p style="color: #94a3b8; font-size: 13px; margin: 0;">Bonjour <strong style="color: #f1f5f9;">${userName}</strong>, voici votre activité des dernières 24h.</p>
                                </div>
                                <table style="width: 100%; border-collapse: collapse;">
                                    ${statRow('💬', 'Nouvelles conversations', newConversations || 0)}
                                    ${statRow('📩', 'Messages reçus', messagesReceived || 0)}
                                    ${statRow('🛒', 'Nouvelles commandes', newOrders || 0)}
                                    ${revenue > 0 ? statRow('💰', 'Revenus encaissés', `${revenue.toLocaleString('fr-FR')} FCFA`) : ''}
                                    ${(newBookings || 0) > 0 ? statRow('📅', 'Réservations', newBookings || 0) : ''}
                                    ${statRow('🔋', 'Crédits utilisés', creditsUsed)}
                                </table>
                            </div>

                            <div style="text-align: center; margin-bottom: 24px;">
                                <a href="${APP_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: white; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px;">
                                    Voir mon tableau de bord
                                </a>
                            </div>

                            <p style="text-align: center; color: #475569; font-size: 11px; margin: 0;">
                                Vous recevez cet email car le résumé quotidien est activé.<br>
                                <a href="${APP_URL}/dashboard/settings" style="color: #64748b;">Désactiver dans les paramètres</a>
                            </p>
                        </div>
                    </body></html>`

                await transporter.sendMail({
                    from: `"WazzapAI" <${fromEmail}>`,
                    to: profile.email,
                    subject: `📊 Résumé du ${dateStr}`,
                    html: emailHtml
                })

                console.log(`📊 [CRON] Daily summary sent to ${profile.email}`)

            } catch (userError) {
                console.error(`📊 [CRON] Error for user ${pref.user_id}:`, userError)
            }
        }

        console.log('📊 [CRON] Daily summary completed.')

    } catch (error) {
        console.error('📊 [CRON] Fatal error in daily summary:', error)
    }
}

// =============================================
// WhatsApp Service Monitor
// =============================================

// Track last notification time to avoid spam (30-min cooldown)
let lastWhatsAppDownNotif = 0

/**
 * Ping the WhatsApp bot service and notify admins if it's down.
 * Includes a 30-minute cooldown between notifications.
 */
export async function checkWhatsAppService(): Promise<void> {
    try {
        const botUrl = process.env.WHATSAPP_BOT_URL || 'http://localhost:3001'
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)

        let isDown = false
        try {
            const res = await fetch(`${botUrl}/health`, { signal: controller.signal })
            if (!res.ok) isDown = true
        } catch {
            isDown = true
        } finally {
            clearTimeout(timeout)
        }

        if (isDown) {
            const now = Date.now()
            const cooldown = 30 * 60 * 1000 // 30 minutes

            if (now - lastWhatsAppDownNotif > cooldown) {
                lastWhatsAppDownNotif = now
                await notifyAdmins('whatsapp_down', {
                    errorMessage: 'Le service WhatsApp bot ne répond pas.',
                })
                console.warn('⚠️ [CRON] WhatsApp service down — admins notified')
            } else {
                console.warn('⚠️ [CRON] WhatsApp service down (notification on cooldown)')
            }
        }
    } catch (error) {
        console.error('⚠️ [CRON] WhatsApp health check error:', error)
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
        checkExpiredSubscriptions()
        sendDailySummary()
    }, {
        timezone: 'UTC'
    })

    // WhatsApp service health check: every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        checkWhatsAppService()
    }, {
        timezone: 'UTC'
    })

    cronInitialized = true
    console.log('⏰ [CRON] Cron jobs initialized — daily tasks at 8:00 AM + WhatsApp monitor every 5 min')
}

// Also export the check functions for manual testing
export { checkExpiringSubscriptions, checkExpiredSubscriptions, sendDailySummary }

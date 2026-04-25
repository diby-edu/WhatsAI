import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { notify } from './notification.service'
import { notifyAdmins } from './admin-notify'
import nodemailer from 'nodemailer'
import {
    fetchUserTestAccountState,
    listUsersWithExpiredPaidGraceWindow,
    listUsersWithExpiredTestCleanupDeadline,
} from '@/lib/test-account'
import { buildAgentDeactivationUpdate } from '@/lib/whatsapp/agent-lifecycle'
import { ACCOUNT_PAID_GRACE_DAYS, resolveGraceUntilFromPaidUntil } from '@/lib/account-lifecycle'
import {
    buildSystemDeletionAuditEntry,
    captureSystemDeletionSnapshot,
    recordSystemDeletionAuditEntry,
} from '@/lib/notifications/system-deletion-audit'
import { getInternalBotBaseUrl } from '@/lib/whatsapp/internal-bot'
import {
    executePlatformSyncConnection,
    isConnectionDueForAutoSync,
} from '@/lib/api/platform-sync-executor'

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

function toErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message
    }

    if (typeof error === 'string' && error.trim()) {
        return error.trim()
    }

    try {
        return JSON.stringify(error)
    } catch {
        return 'unknown_error'
    }
}

function buildEmptyDeletionSnapshot() {
    return {
        capturedAt: new Date().toISOString(),
        relatedCounts: {
            agents: 0,
            whatsapp_sessions: 0,
            conversations: 0,
            messages: 0,
            knowledge_base: 0,
            products: 0,
            subscriptions: 0,
            payments: 0,
            orders: 0,
        },
    }
}

async function persistSystemDeletionAudit(
    supabase: ReturnType<typeof getAdminSupabase>,
    payload: Parameters<typeof buildSystemDeletionAuditEntry>[0]
) {
    try {
        const entry = buildSystemDeletionAuditEntry(payload)
        await recordSystemDeletionAuditEntry(supabase, entry)
    } catch (auditError) {
        console.error('[CRON] Failed to persist system deletion audit log:', auditError)
    }
}

async function updateProfileFreezeState(
    supabase: ReturnType<typeof getAdminSupabase>,
    userId: string,
    payload: Record<string, unknown>
) {
    let { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', userId)

    if (error?.code === '42703') {
        const fallbackPayload = { ...payload }
        delete fallbackPayload.grace_until
        delete fallbackPayload.account_lifecycle_status

        ;({ error } = await supabase
            .from('profiles')
            .update(fallbackPayload)
            .eq('id', userId))
    }

    if (error?.code === '42703') {
        const legacyPayload = { ...payload }
        delete legacyPayload.grace_until
        delete legacyPayload.account_lifecycle_status
        delete legacyPayload.credits_frozen_at
        delete legacyPayload.credits_expire_at

        ;({ error } = await supabase
            .from('profiles')
            .update(legacyPayload)
            .eq('id', userId))
    }

    return error
}

async function freezePaidLifecycleForUser(
    supabase: ReturnType<typeof getAdminSupabase>,
    userId: string,
    paidUntilInput?: string | null
) {
    let profileQuery = await supabase
        .from('profiles')
        .select('plan, credits_balance, paid_until, grace_until, account_lifecycle_status')
        .eq('id', userId)
        .single()

    if (profileQuery.error?.code === '42703') {
        profileQuery = await supabase
            .from('profiles')
            .select('plan, credits_balance, paid_until, grace_until')
            .eq('id', userId)
            .single()
    }

    if (profileQuery.error?.code === '42703') {
        profileQuery = await supabase
            .from('profiles')
            .select('plan, credits_balance')
            .eq('id', userId)
            .single()
    }

    if (profileQuery.error) {
        throw profileQuery.error
    }

    const profile = profileQuery.data || {}
    const currentStatus = String((profile as any).account_lifecycle_status || '').trim().toLowerCase()
    const currentGraceUntil = String((profile as any).grace_until || '').trim()
    const nowMs = Date.now()

    if (currentStatus === 'frozen_grace' && currentGraceUntil) {
        const currentGraceMs = new Date(currentGraceUntil).getTime()
        if (Number.isFinite(currentGraceMs) && currentGraceMs > nowMs) {
            return {
                frozen: false,
                graceUntil: currentGraceUntil,
            }
        }
    }

    const freezeDate = new Date(nowMs)
    const paidUntil = paidUntilInput || (profile as any).paid_until || freezeDate.toISOString()
    const graceUntil = resolveGraceUntilFromPaidUntil(paidUntil, nowMs, ACCOUNT_PAID_GRACE_DAYS)
    const currentBalance = Number((profile as any).credits_balance || 0)

    const profileUpdateError = await updateProfileFreezeState(supabase, userId, {
        plan: 'free',
        credits_frozen_at: freezeDate.toISOString(),
        credits_expire_at: graceUntil,
        grace_until: graceUntil,
        account_lifecycle_status: 'frozen_grace',
    })

    if (profileUpdateError) {
        throw profileUpdateError
    }

    if (currentBalance > 0) {
        await notify(userId, 'credits_freeze_warning', {
            balance: currentBalance,
            creditExpireDate: new Date(graceUntil).toLocaleDateString('fr-FR')
        })
    }

    const { data: userAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', userId)
        .is('archived_at', null)

    if (userAgents && userAgents.length > 0) {
        const toDeactivate = userAgents.map((agent: any) => agent.id)
        await supabase
            .from('agents')
            .update({
                archived_at: freezeDate.toISOString(),
                archived_reason: 'payment_window_expired',
                ...buildAgentDeactivationUpdate(),
            })
            .in('id', toDeactivate)

        await notify(userId, 'agent_archived', {
            count: toDeactivate.length,
            deleteDate: new Date(graceUntil).toLocaleDateString('fr-FR')
        })
    }

    return {
        frozen: true,
        graceUntil,
    }
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
        const botUrl = getInternalBotBaseUrl()
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
                    await persistSystemDeletionAudit(supabase, {
                        profile,
                        reason: 'expired_paid_grace',
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

/**
 * Auto-sync external catalogues (Woo/Shopify) for external_sync agents.
 * Runs every 5 minutes and retries failed syncs with backoff.
 */
async function handlePlatformCatalogAutoSync(): Promise<void> {
    try {
        const supabase = getAdminSupabase()
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

    // Schedule: every day at 8:00 AM UTC
    cron.schedule('0 8 * * *', () => {
        checkExpiringSubscriptions()
        checkExpiredSubscriptions()
        checkExpiredPaidAccounts()
        sendDailySummary()
    }, {
        timezone: 'UTC'
    })

    // Daily at 22:30 UTC — agent archive lifecycle + credit expiry + 85% usage alert
    cron.schedule('30 22 * * *', () => {
        handleArchivedAgentLifecycle()
        handleCreditExpiry()
        checkHighCreditUsage()
        handlePaidAccountCleanup()
        handleTestAccountCleanup()
    }, {
        timezone: 'UTC'
    })

    // WhatsApp service health check: every 5 minutes
    cron.schedule('*/5 * * * *', () => {
        checkWhatsAppService()
        handlePlatformCatalogAutoSync()
    }, {
        timezone: 'UTC'
    })

    cronInitialized = true
    console.log('⏰ [CRON] Cron jobs initialized — daily tasks at 8:00/9:00 AM + WhatsApp monitor every 5 min')
}

// Also export the check functions for manual testing
export {
    checkExpiringSubscriptions,
    checkExpiredSubscriptions,
    checkExpiredPaidAccounts,
    sendDailySummary,
    handleArchivedAgentLifecycle,
    handleCreditExpiry,
    checkHighCreditUsage,
    handlePaidAccountCleanup,
    handleTestAccountCleanup,
    handlePlatformCatalogAutoSync,
}

import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'
import { sendNotificationToUser, type PushNotificationPayload } from './firebase-admin'

// =============================================
// Admin Notification Service
// Sends push + email to all admin/superadmin users
// and persists events to admin_notifications table (shown in the bell)
// =============================================

export type AdminNotifType =
    | 'new_user'
    | 'plan_upgrade'
    | 'plan_downgrade'
    | 'payment_received'
    | 'payment_failed'
    | 'subscription_cancelled'
    | 'agent_created'
    | 'agent_connected'
    | 'agent_disconnected'
    | 'agent_quota_exceeded'
    | 'openai_error'
    | 'whatsapp_down'
    | 'high_error_rate'
    | 'new_conversation'
    | 'new_order'
    | 'escalation'

export interface AdminNotifData {
    userId?: string
    userEmail?: string
    userName?: string
    planName?: string
    previousPlan?: string
    paymentAmount?: number
    agentName?: string
    agentId?: string
    contactPhone?: string
    contactName?: string
    orderNumber?: string
    totalAmount?: number
    errorMessage?: string
    creditsAdded?: number
    [key: string]: unknown
}

function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// SMTP transporter (lazy, singleton)
let _transporter: nodemailer.Transporter | null = null
function getTransporter(): nodemailer.Transporter | null {
    if (_transporter) return _transporter
    const host = process.env.SMTP_HOST
    const user = process.env.SMTP_USER
    const pass = process.env.SMTP_PASSWORD
    if (!host || !user || !pass) return null
    const port = parseInt(process.env.SMTP_PORT || '465')
    _transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    })
    return _transporter
}

const FROM_NAME = process.env.SMTP_FROM_NAME || 'WazzapAI Admin'
const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'support@wazzapai.com'

// =============================================
// Notification Content
// =============================================

function getContent(type: AdminNotifType, data: AdminNotifData): { title: string; body: string } {
    switch (type) {
        case 'new_user':
            return {
                title: '👤 Nouvel utilisateur',
                body: `${data.userEmail || 'Un utilisateur'} vient de s'inscrire.`,
            }
        case 'plan_upgrade':
            return {
                title: '⬆️ Plan mis à niveau',
                body: `${data.userName || data.userEmail || 'Un utilisateur'} → plan ${data.planName || ''}.`,
            }
        case 'plan_downgrade':
            return {
                title: '⬇️ Plan rétrogradé',
                body: `${data.userName || data.userEmail || 'Utilisateur'} : ${data.previousPlan || ''} → ${data.planName || 'Free'}.`,
            }
        case 'payment_received':
            return {
                title: '💰 Paiement reçu',
                body: `${data.userEmail || 'Utilisateur'} — ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA${data.planName ? ` (${data.planName})` : ''}.`,
            }
        case 'payment_failed':
            return {
                title: '❌ Paiement échoué',
                body: `Paiement de ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA échoué — ${data.userEmail || 'utilisateur inconnu'}.`,
            }
        case 'subscription_cancelled':
            return {
                title: '🚫 Abonnement annulé',
                body: `Abonnement de ${data.userName || data.userEmail || 'un utilisateur'} annulé (retour Free).`,
            }
        case 'agent_created':
            return {
                title: '🤖 Nouvel agent créé',
                body: `Agent "${data.agentName || ''}" créé par ${data.userEmail || 'un utilisateur'}.`,
            }
        case 'agent_connected':
            return {
                title: '✅ Agent connecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" est maintenant connecté.`,
            }
        case 'agent_disconnected':
            return {
                title: '🔌 Agent déconnecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" s'est déconnecté de WhatsApp.`,
            }
        case 'agent_quota_exceeded':
            return {
                title: '⚠️ Quota agents dépassé',
                body: `${data.userEmail || 'Un utilisateur'} a atteint sa limite d'agents (plan ${data.planName || ''}).`,
            }
        case 'openai_error':
            return {
                title: '🚨 Erreur API OpenAI',
                body: `Erreur OpenAI détectée : ${data.errorMessage || 'Erreur inconnue'}.`,
            }
        case 'whatsapp_down':
            return {
                title: '⚠️ Service WhatsApp indisponible',
                body: 'Le service WhatsApp bot est hors ligne.',
            }
        case 'high_error_rate':
            return {
                title: "📊 Taux d'erreur élevé",
                body: `Taux d'erreur anormal détecté. ${data.errorMessage || ''}`.trim(),
            }
        case 'new_conversation':
            return {
                title: '💬 Nouvelle conversation',
                body: `${data.contactName || data.contactPhone || 'Un contact'} → agent ${data.agentName || ''}.`,
            }
        case 'new_order':
            return {
                title: '🛒 Nouvelle commande (admin)',
                body: `${(data.totalAmount || 0).toLocaleString('fr-FR')} FCFA — ${data.contactName || data.contactPhone || 'client'}.`,
            }
        case 'escalation':
            return {
                title: '🚨 Escalade conversation',
                body: `${data.contactName || data.contactPhone || 'Un client'} demande un humain (${data.agentName || ''}).`,
            }
    }
}

function getPushPayload(type: AdminNotifType, data: AdminNotifData): PushNotificationPayload {
    const { title, body } = getContent(type, data)
    const routeMap: Record<AdminNotifType, string> = {
        new_user: '/admin/users',
        plan_upgrade: '/admin/subscriptions',
        plan_downgrade: '/admin/subscriptions',
        payment_received: '/admin/payments',
        payment_failed: '/admin/payments',
        subscription_cancelled: '/admin/subscriptions',
        agent_created: '/admin/agents',
        agent_connected: '/admin/agents',
        agent_disconnected: '/admin/agents',
        agent_quota_exceeded: '/admin/users',
        openai_error: '/admin/diagnostics',
        whatsapp_down: '/admin/diagnostics',
        high_error_rate: '/admin/diagnostics',
        new_conversation: '/admin/conversations',
        new_order: '/admin/orders',
        escalation: '/admin/conversations',
    }
    return { title, body, data: { type, route: routeMap[type] } }
}

function getEmailHtml(type: AdminNotifType, data: AdminNotifData): string {
    const { title, body } = getContent(type, data)
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://wazzapai.com'
    return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#020617;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);padding:12px 16px;border-radius:14px;">
        <span style="color:white;font-size:24px;font-weight:700;">💬 WazzapAI</span>
      </div>
    </div>
    <div style="background:rgba(15,23,42,0.95);border:1px solid rgba(148,163,184,0.15);border-radius:20px;padding:32px;color:#e2e8f0;">
      <h2 style="margin:0 0 16px 0;font-size:20px;color:#f1f5f9;">${title}</h2>
      <p style="margin:0 0 24px 0;color:#94a3b8;font-size:16px;line-height:1.6;">${body}</p>
      <a href="${APP_URL}/admin" style="display:inline-block;background:linear-gradient(135deg,#10b981,#059669);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:600;font-size:15px;">Voir dans l'admin</a>
    </div>
    <div style="text-align:center;margin-top:24px;color:#64748b;font-size:12px;">
      <p>WazzapAI — Notification automatique admin</p>
    </div>
  </div>
</body>
</html>`
}

async function sendAdminEmail(adminId: string, type: AdminNotifType, data: AdminNotifData, supabase: ReturnType<typeof getAdminSupabase>): Promise<void> {
    const transporter = getTransporter()
    if (!transporter) return

    try {
        const { data: userData } = await supabase.auth.admin.getUserById(adminId)
        const adminEmail = userData?.user?.email
        if (!adminEmail) return

        const { title } = getContent(type, data)
        await transporter.sendMail({
            from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
            to: adminEmail,
            subject: title,
            html: getEmailHtml(type, data),
        })
        console.log(`📧 Admin email [${type}] → ${adminEmail}`)
    } catch (err) {
        console.error(`📧 Admin email error [${type}]:`, err)
    }
}

// =============================================
// Main Export
// =============================================

/**
 * Send a notification to all admin/superadmin users, respecting their preferences.
 * Also persists the event to admin_notifications table so it appears in the bell.
 * Safe to call from any server-side context — never throws.
 */
export async function notifyAdmins(
    type: AdminNotifType,
    data: AdminNotifData = {}
): Promise<void> {
    try {
        const supabase = getAdminSupabase()

        // 1. Get all admin users
        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .in('role', ['admin', 'superadmin'])

        if (!admins || admins.length === 0) return

        const pushCol = `push_${type}`
        const emailCol = `email_${type}`

        const { title, body } = getContent(type, data)

        // 2. Persist event to admin_notifications (shows in bell for all admins)
        await supabase.from('admin_notifications').insert({
            type,
            title,
            message: body,
            data: data as Record<string, unknown>,
        }).then(({ error }) => {
            if (error) console.warn('admin_notifications insert error:', error.message)
        })

        // 3. For each admin, check preferences and send push + email
        for (const admin of admins) {
            try {
                const { data: prefs } = await supabase
                    .from('admin_notification_preferences')
                    .select(`${pushCol}, ${emailCol}`)
                    .eq('admin_id', admin.id)
                    .maybeSingle()

                // Default ON if no preferences saved
                const pushEnabled = prefs ? prefs[pushCol] !== false : true
                const emailEnabled = prefs ? prefs[emailCol] === true : false

                if (pushEnabled) {
                    await sendNotificationToUser(supabase, admin.id, getPushPayload(type, data))
                }

                if (emailEnabled) {
                    await sendAdminEmail(admin.id, type, data, supabase)
                }
            } catch (adminErr) {
                console.error(`notifyAdmins error for admin ${admin.id}:`, adminErr)
            }
        }

        console.log(`🔔 Admin notification [${type}] dispatched to ${admins.length} admin(s)`)
    } catch (error) {
        // CRITICAL: Never break business logic
        console.error(`notifyAdmins [${type}] error:`, error)
    }
}

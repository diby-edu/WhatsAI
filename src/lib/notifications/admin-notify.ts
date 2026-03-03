import { createClient } from '@supabase/supabase-js'
import { sendNotificationToUser, type PushNotificationPayload } from './firebase-admin'

// =============================================
// Admin Notification Service
// Sends notifications to all admin/superadmin users
// based on their admin_notification_preferences
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

function getPushContent(type: AdminNotifType, data: AdminNotifData): PushNotificationPayload {
    switch (type) {
        case 'new_user':
            return {
                title: '👤 Nouvel utilisateur',
                body: `${data.userEmail || 'Un utilisateur'} vient de s\'inscrire.`,
                data: { type, route: '/admin/users' }
            }
        case 'plan_upgrade':
            return {
                title: '⬆️ Plan mis à niveau',
                body: `${data.userName || data.userEmail || 'Un utilisateur'} → plan ${data.planName || ''}.`,
                data: { type, route: '/admin/subscriptions' }
            }
        case 'plan_downgrade':
            return {
                title: '⬇️ Plan rétrogradé',
                body: `${data.userName || data.userEmail || 'Un utilisateur'} : ${data.previousPlan || ''} → ${data.planName || 'Free'}.`,
                data: { type, route: '/admin/subscriptions' }
            }
        case 'payment_received':
            return {
                title: '💰 Paiement reçu',
                body: `${data.userEmail || 'Utilisateur'} — ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA${data.planName ? ` (${data.planName})` : ''}.`,
                data: { type, route: '/admin/payments' }
            }
        case 'payment_failed':
            return {
                title: '❌ Paiement échoué',
                body: `Paiement de ${(data.paymentAmount || 0).toLocaleString('fr-FR')} FCFA échoué — ${data.userEmail || 'utilisateur inconnu'}.`,
                data: { type, route: '/admin/payments' }
            }
        case 'subscription_cancelled':
            return {
                title: '🚫 Abonnement annulé',
                body: `Abonnement de ${data.userName || data.userEmail || 'un utilisateur'} annulé (retour Free).`,
                data: { type, route: '/admin/subscriptions' }
            }
        case 'agent_created':
            return {
                title: '🤖 Nouvel agent créé',
                body: `Agent "${data.agentName || ''}" créé par ${data.userEmail || 'un utilisateur'}.`,
                data: { type, route: '/admin/agents' }
            }
        case 'agent_connected':
            return {
                title: '✅ Agent connecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" est maintenant connecté.`,
                data: { type, route: '/admin/agents' }
            }
        case 'agent_disconnected':
            return {
                title: '🔌 Agent déconnecté WhatsApp',
                body: `L'agent "${data.agentName || ''}" s'est déconnecté de WhatsApp.`,
                data: { type, route: '/admin/agents' }
            }
        case 'agent_quota_exceeded':
            return {
                title: '⚠️ Quota agents dépassé',
                body: `${data.userEmail || 'Un utilisateur'} a atteint sa limite d'agents (plan ${data.planName || ''}).`,
                data: { type, route: '/admin/users' }
            }
        case 'openai_error':
            return {
                title: '🚨 Erreur API OpenAI',
                body: `Erreur OpenAI détectée : ${data.errorMessage || 'Erreur inconnue'}.`,
                data: { type, route: '/admin/diagnostics' }
            }
        case 'whatsapp_down':
            return {
                title: '⚠️ Service WhatsApp indisponible',
                body: 'Le service WhatsApp bot est hors ligne.',
                data: { type, route: '/admin/diagnostics' }
            }
        case 'high_error_rate':
            return {
                title: '📊 Taux d\'erreur élevé',
                body: `Taux d'erreur anormal détecté. ${data.errorMessage || ''}`.trim(),
                data: { type, route: '/admin/diagnostics' }
            }
        case 'new_conversation':
            return {
                title: '💬 Nouvelle conversation',
                body: `${data.contactName || data.contactPhone || 'Un contact'} → agent ${data.agentName || ''}.`,
                data: { type, route: '/admin/conversations' }
            }
        case 'new_order':
            return {
                title: '🛒 Nouvelle commande (admin)',
                body: `${(data.totalAmount || 0).toLocaleString('fr-FR')} FCFA — ${data.contactName || data.contactPhone || 'client'}.`,
                data: { type, route: '/admin/orders' }
            }
        case 'escalation':
            return {
                title: '🚨 Escalade conversation',
                body: `${data.contactName || data.contactPhone || 'Un client'} demande un humain (${data.agentName || ''}).`,
                data: { type, route: '/admin/conversations' }
            }
    }
}

/**
 * Send a notification to all admin/superadmin users, respecting their preferences.
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

        // 2. For each admin, check preferences and send push
        for (const admin of admins) {
            try {
                const { data: prefs } = await supabase
                    .from('admin_notification_preferences')
                    .select(`${pushCol}, ${emailCol}`)
                    .eq('admin_id', admin.id)
                    .maybeSingle()

                // Default ON if no preferences saved
                const pushEnabled = prefs ? prefs[pushCol] !== false : true

                if (pushEnabled) {
                    const pushContent = getPushContent(type, data)
                    await sendNotificationToUser(supabase, admin.id, pushContent)
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

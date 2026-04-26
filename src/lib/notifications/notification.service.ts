import { sendNotificationToUser, type PushNotificationPayload } from './firebase-admin'
import { sendLowCreditsEmail, sendCreditsDepletedEmail, sendSubscriptionExpiringEmail } from './email.service'
import { createClient } from '@supabase/supabase-js'

// =============================================
// Notification Service - Central orchestrator
// Checks user preferences then dispatches via push and/or email
// =============================================

const LOW_CREDITS_THRESHOLD = 20

// Admin Supabase client (service role) for reading preferences
function getAdminSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
}

// =============================================
// Notification Types
// =============================================

export type NotificationType =
    // Credits & Billing (push + email)
    | 'low_credits'
    | 'credits_depleted'
    | 'subscription_expiring'
    // Orders & Payments (push + email)
    | 'new_order'
    | 'order_cancelled'
    | 'payment_received'
    // Bookings (push only)
    | 'new_booking'
    // Conversations (push only)
    | 'new_conversation'
    | 'escalation'
    // Agent (push only)
    | 'agent_status_change'
    // Products (push only)
    | 'stock_out'
    // Subscription protection (push only)
    | 'agent_archived'
    | 'agent_delete_warning'
    | 'credit_usage_high'
    | 'credits_freeze_warning'
    | 'credits_expired'
    | 'scale_renewal_bonus'
    // Leads
    | 'new_lead'

export interface NotificationData {
    // For credits
    balance?: number
    // For subscription
    planName?: string
    daysLeft?: number
    expiryDate?: string
    // For orders
    orderNumber?: string
    customerName?: string
    totalAmount?: number
    // For conversations
    contactPhone?: string
    contactName?: string
    // For payments
    paymentAmount?: number
    paymentMethod?: string
    // For bookings
    serviceName?: string
    bookingDate?: string
    bookingTime?: string
    // For agent
    agentName?: string
    agentStatus?: 'connected' | 'disconnected'
    // For stock
    productName?: string
    // For agent archival
    count?: number
    deleteDate?: string
    // For credit freeze/expiry
    creditExpireDate?: string
    // For credit usage high
    usagePct?: number
    // For Scale renewal bonus
    rolloverAmount?: number
    bonusAmount?: number
}

// Mapping: notification type → preference DB column names
const PREF_MAP: Record<NotificationType, { push?: string; email?: string }> = {
    low_credits: { push: 'push_low_credits', email: 'email_low_credits' },
    credits_depleted: { push: 'push_credits_depleted', email: 'email_credits_depleted' },
    subscription_expiring: { push: 'push_subscription_expiring', email: 'email_subscription_expiring' },
    new_order: { push: 'push_new_order' },
    order_cancelled: { push: 'push_order_cancelled' },
    payment_received: { push: 'push_payment_received', email: 'email_payment_received' },
    new_booking: { push: 'push_new_booking' },
    new_conversation: { push: 'push_new_conversation' },
    escalation: { push: 'push_escalation' },
    agent_status_change: { push: 'push_agent_status_change' },
    stock_out: { push: 'push_stock_out' },
    agent_archived: { push: 'push_agent_archived' },
    agent_delete_warning: { push: 'push_agent_delete_warning' },
    credit_usage_high: { push: 'push_credit_usage_high' },
    credits_freeze_warning: { push: 'push_credits_freeze_warning' },
    credits_expired: { push: 'push_credits_expired' },
    scale_renewal_bonus: { push: 'push_scale_renewal_bonus' },
    new_lead: { push: 'push_new_lead', email: 'email_new_lead' },
}

// =============================================
// Push Notification Content
// =============================================

function getPushContent(type: NotificationType, data: NotificationData): PushNotificationPayload {
    switch (type) {
        case 'low_credits':
            return {
                title: '⚠️ Crédits faibles',
                body: `Il vous reste ${data.balance} crédits. Rechargez pour éviter l'interruption.`,
                data: { type: 'low_credits', route: '/dashboard/billing' }
            }
        case 'credits_depleted':
            return {
                title: '🚨 Crédits épuisés',
                body: 'Votre agent IA est en pause. Rechargez vos crédits.',
                data: { type: 'credits_depleted', route: '/dashboard/billing' }
            }
        case 'subscription_expiring':
            return {
                title: '📅 Abonnement expire bientôt',
                body: `Votre plan ${data.planName} expire dans ${data.daysLeft} jour${(data.daysLeft || 0) > 1 ? 's' : ''}.`,
                data: { type: 'subscription_expiring', route: '/dashboard/billing' }
            }
        case 'new_order':
            return {
                title: '🛒 Nouvelle commande !',
                body: `Commande ${data.orderNumber || ''} de ${data.customerName || 'un client'} — ${data.totalAmount || 0} FCFA`,
                data: { type: 'new_order', route: '/dashboard/orders' }
            }
        case 'order_cancelled':
            return {
                title: '❌ Commande annulée',
                body: `La commande ${data.orderNumber || ''} a été annulée.`,
                data: { type: 'order_cancelled', route: '/dashboard/orders' }
            }
        case 'new_conversation':
            return {
                title: '💬 Nouvelle conversation',
                body: `${data.contactName || data.contactPhone || 'Un contact'} vous a écrit sur WhatsApp.`,
                data: { type: 'new_message', route: '/dashboard/messages' }
            }
        case 'escalation':
            return {
                title: '🚨 Escalade demandée',
                body: `${data.contactName || data.contactPhone || 'Un client'} demande un humain.`,
                data: { type: 'escalation', route: '/dashboard/messages' }
            }
        case 'agent_status_change':
            return {
                title: data.agentStatus === 'connected' ? '✅ Agent connecté' : '❌ Agent déconnecté',
                body: `L'agent "${data.agentName}" est maintenant ${data.agentStatus === 'connected' ? 'en ligne' : 'hors ligne'}.`,
                data: { type: 'agent_status', route: '/dashboard/agents' }
            }
        case 'payment_received':
            return {
                title: '💰 Paiement reçu !',
                body: `${data.customerName || 'Un client'} a payé ${data.paymentAmount?.toLocaleString('fr-FR') || 0} FCFA — Commande #${data.orderNumber?.substring(0, 8) || ''}`,
                data: { type: 'payment_received', route: '/dashboard/orders' }
            }
        case 'new_booking':
            return {
                title: '📅 Nouvelle réservation !',
                body: `${data.customerName || 'Un client'} a réservé ${data.serviceName || 'un service'} le ${data.bookingDate || ''}${data.bookingTime ? ' à ' + data.bookingTime : ''}`,
                data: { type: 'new_booking', route: '/dashboard/bookings' }
            }
        case 'stock_out':
            return {
                title: '📦 Stock épuisé',
                body: `Le produit "${data.productName}" est en rupture de stock.`,
                data: { type: 'stock_out', route: '/dashboard/products' }
            }
        case 'agent_archived':
            return {
                title: '🔒 Agents archivés',
                body: `${data.count} agent${(data.count || 0) > 1 ? 's' : ''} archivé${(data.count || 0) > 1 ? 's' : ''} suite à l'expiration. Suppression le ${data.deleteDate}.`,
                data: { type: 'agent_archived', route: '/dashboard/agents' }
            }
        case 'agent_delete_warning':
            return {
                title: '⚠️ Agents bientôt supprimés',
                body: `Vos agents archivés seront supprimés définitivement dans 7 jours. Renouvelez pour les restaurer.`,
                data: { type: 'agent_delete_warning', route: '/dashboard/billing' }
            }
        case 'credit_usage_high':
            return {
                title: '🚀 85% de vos crédits utilisés',
                body: `Vous avez consommé ${data.usagePct}% de votre forfait ce mois. Passez au plan supérieur.`,
                data: { type: 'credit_usage_high', route: '/dashboard/billing' }
            }
        case 'credits_freeze_warning':
            return {
                title: '🛡️ Crédits sécurisés',
                body: `Vos ${data.balance} crédits sont sécurisés jusqu'au ${data.creditExpireDate}. Renouvelez pour les réactiver.`,
                data: { type: 'credits_freeze_warning', route: '/dashboard/billing' }
            }
        case 'credits_expired':
            return {
                title: '💸 Crédits expirés',
                body: 'Vos crédits ont expiré (14 jours sans abonnement). Souscrivez un plan pour recharger.',
                data: { type: 'credits_expired', route: '/dashboard/billing' }
            }
        case 'scale_renewal_bonus':
            return {
                title: '✨ Bonus Scale appliqué !',
                body: `Rollover : +${data.rolloverAmount} crédits (20%). Bonus mensuel : +${data.bonusAmount} crédits. Solde : ${data.balance?.toLocaleString()}.`,
                data: { type: 'scale_renewal_bonus', route: '/dashboard/billing' }
            }
        case 'new_lead':
            return {
                title: '🎯 Nouveau lead qualifié !',
                body: `${data.contactName || data.contactPhone || 'Un prospect'} a été capturé${data.agentName ? ` par l'agent "${data.agentName}"` : ''}.`,
                data: { type: 'new_lead', route: '/dashboard/agents' }
            }
    }
}

// =============================================
// Main Notification Function
// =============================================

/**
 * Send a notification to a user, respecting their preferences.
 * This is the ONLY function business routes should call.
 * 
 * @param userId - The user ID to notify
 * @param type - The notification type
 * @param data - Additional data for the notification content
 */
export async function notify(
    userId: string,
    type: NotificationType,
    data: NotificationData = {}
): Promise<void> {
    try {
        const supabase = getAdminSupabase()

        // 1. Get user preferences
        const { data: prefs } = await supabase
            .from('notification_preferences')
            .select('*')
            .eq('user_id', userId)
            .single()

        // Default: all notifications ON if no preferences saved
        const prefMapping = PREF_MAP[type]

        // 2. Send PUSH if enabled
        const pushEnabled = prefMapping.push
            ? (prefs?.[prefMapping.push] !== false) // default true
            : false

        if (pushEnabled) {
            const pushContent = getPushContent(type, data)
            await sendNotificationToUser(supabase, userId, pushContent)
        }

        // 3. Send EMAIL if enabled and this type supports email
        const emailEnabled = prefMapping.email
            ? (prefs?.[prefMapping.email] !== false) // default true
            : false

        if (emailEnabled) {
            // Get user email
            const { data: userData } = await supabase.auth.admin.getUserById(userId)
            const userEmail = userData?.user?.email
            const userName = userData?.user?.user_metadata?.full_name || 'Utilisateur'

            if (userEmail) {
                switch (type) {
                    case 'low_credits':
                        await sendLowCreditsEmail(userEmail, userName, data.balance || 0)
                        break
                    case 'credits_depleted':
                        await sendCreditsDepletedEmail(userEmail, userName)
                        break
                    case 'subscription_expiring':
                        await sendSubscriptionExpiringEmail(
                            userEmail,
                            userName,
                            data.planName || 'WazzapAI',
                            data.daysLeft || 7,
                            data.expiryDate || ''
                        )
                        break
                }
            }
        }

        console.log(`🔔 Notification [${type}] processed for user ${userId}`)

    } catch (error) {
        // CRITICAL: Never let notification errors break business logic
        console.error(`🔔 Notification error [${type}] for user ${userId}:`, error)
    }
}

// =============================================
// Convenience exports
// =============================================

export { LOW_CREDITS_THRESHOLD }
export const NotificationService = { notify, LOW_CREDITS_THRESHOLD }
export default NotificationService

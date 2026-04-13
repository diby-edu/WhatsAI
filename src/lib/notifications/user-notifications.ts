import { createClient } from '@/lib/supabase/client'
import { formatPriceFromFcfa } from '@/lib/currency'

export type DashboardNotificationKind = 'info' | 'success' | 'warning' | 'order' | 'credits' | 'push'
export type DashboardNotificationSource = 'order' | 'conversation' | 'credits' | 'notification_log'

export interface DashboardNotification {
    id: string
    source: DashboardNotificationSource
    type: DashboardNotificationKind
    title: string
    message: string
    time: string
    createdAt: string
    read: boolean
    href: string
    targetHref?: string
    notificationLogId?: string
    dismissible: boolean
}

export interface DashboardNotificationProfile {
    avatarUrl: string | null
    fullName: string
    creditsBalance: number | null
}

export interface DashboardNotificationsResult {
    notifications: DashboardNotification[]
    profile: DashboardNotificationProfile
}

const READ_STORAGE_KEY = 'wazzapai_read_notifications'

function getStoredReadIds(): Set<string> {
    if (typeof window === 'undefined') return new Set()

    try {
        const raw = window.localStorage.getItem(READ_STORAGE_KEY)
        if (!raw) return new Set()

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? new Set(parsed.filter((value) => typeof value === 'string')) : new Set()
    } catch {
        return new Set()
    }
}

function saveStoredReadIds(ids: Set<string>) {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(READ_STORAGE_KEY, JSON.stringify(Array.from(ids)))
}

export function markNotificationReadLocal(id: string) {
    const ids = getStoredReadIds()
    ids.add(id)
    saveStoredReadIds(ids)
}

export function markNotificationsReadLocal(notificationIds: string[]) {
    const ids = getStoredReadIds()
    notificationIds.forEach((id) => ids.add(id))
    saveStoredReadIds(ids)
}

function formatBellTime(dateLike: string | Date) {
    const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / 3600000)

    const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    if (hours < 24) return timeStr

    const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
    return `${dateStr} ${timeStr}`
}

function buildFocusHref(notificationId: string) {
    return `/dashboard/notifications?notification=${encodeURIComponent(notificationId)}`
}

function getLogTitle(type: string, data?: Record<string, unknown>): string {
    if (typeof data?.title === 'string' && data.title.trim()) return data.title.trim()

    const titles: Record<string, string> = {
        low_credits: 'Credits faibles',
        credits_depleted: 'Credits epuises',
        subscription_expiring: 'Abonnement bientot expire',
        new_order: 'Nouvelle commande',
        order_cancelled: 'Commande annulee',
        payment_received: 'Paiement recu',
        new_conversation: 'Nouvelle conversation',
        escalation: 'Escalade demandee',
        new_booking: 'Nouvelle reservation',
        agent_status_change: 'Statut agent modifie',
        stock_out: 'Stock epuise',
        agent_archived: 'Agents archives',
        agent_delete_warning: 'Agents bientot supprimes',
        credit_usage_high: 'Credits presque consommes',
        credits_freeze_warning: 'Credits securises',
        credits_expired: 'Credits expires',
        scale_renewal_bonus: 'Bonus applique',
        broadcast_push: 'Annonce',
    }

    return titles[type] || 'Notification'
}

function getLogMessage(type: string, data?: Record<string, unknown>): string {
    if (typeof data?.body === 'string' && data.body.trim()) return data.body.trim()
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()

    const balance = typeof data?.balance === 'number'
        ? data.balance
        : typeof data?.credits_balance === 'number'
            ? data.credits_balance
            : null
    const daysLeft = typeof data?.days_left === 'number' ? data.days_left : null

    switch (type) {
        case 'low_credits':
            return `Il vous reste ${balance ?? 'peu de'} credits.`
        case 'credits_depleted':
            return 'Vos credits sont epuises. Rechargez pour relancer votre activite.'
        case 'subscription_expiring':
            return daysLeft
                ? `Votre abonnement expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}.`
                : 'Votre abonnement expire bientot.'
        case 'payment_received':
            return 'Un paiement a ete recu sur votre compte.'
        case 'new_order':
            return 'Vous avez recu une nouvelle commande.'
        case 'new_conversation':
            return 'Une nouvelle conversation a demarre.'
        case 'broadcast_push':
            return 'Vous avez recu une nouvelle annonce.'
        default:
            return 'Vous avez une nouvelle notification.'
    }
}

function getLogTargetHref(data?: Record<string, unknown>) {
    if (typeof data?.route === 'string' && data.route.trim()) return data.route.trim()
    return '/dashboard/notifications'
}

export async function fetchDashboardNotifications(limit: number = 50): Promise<DashboardNotificationsResult> {
    const supabase = createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return {
            notifications: [],
            profile: {
                avatarUrl: null,
                fullName: '',
                creditsBalance: null,
            },
        }
    }

    const now = new Date()
    const storedReadIds = getStoredReadIds()
    const notifications: DashboardNotification[] = []

    const { data: profile } = await supabase
        .from('profiles')
        .select('credits_balance, avatar_url, full_name, currency')
        .eq('id', user.id)
        .single()

    const profileData: DashboardNotificationProfile = {
        avatarUrl: profile?.avatar_url ?? null,
        fullName: profile?.full_name ?? '',
        creditsBalance: typeof profile?.credits_balance === 'number' ? profile.credits_balance : null,
    }

    const { data: userAgents } = await supabase
        .from('agents')
        .select('id')
        .eq('user_id', user.id)

    const agentIds = userAgents?.map((agent) => agent.id) || []

    if (agentIds.length > 0) {
        const { data: recentOrders } = await supabase
            .from('orders')
            .select('id, order_number, total_fcfa, created_at')
            .in('agent_id', agentIds)
            .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(10)

        recentOrders?.forEach((order) => {
            const id = `order-${order.id}`
            const createdAt = order.created_at

            notifications.push({
                id,
                source: 'order',
                type: 'order',
                title: 'Nouvelle commande',
                message: `#${order.order_number} - ${formatPriceFromFcfa(order.total_fcfa ?? 0, profile?.currency || 'XOF')}`,
                time: formatBellTime(createdAt),
                createdAt,
                read: storedReadIds.has(id),
                href: buildFocusHref(id),
                targetHref: `/dashboard/orders/${order.id}`,
                dismissible: false,
            })
        })

        const { data: recentConversations } = await supabase
            .from('conversations')
            .select('id, contact_name, created_at')
            .in('agent_id', agentIds)
            .gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
            .limit(10)

        recentConversations?.forEach((conversation) => {
            const id = `convo-${conversation.id}`
            const createdAt = conversation.created_at

            notifications.push({
                id,
                source: 'conversation',
                type: 'info',
                title: 'Nouvelle conversation',
                message: conversation.contact_name || 'Contact WhatsApp',
                time: formatBellTime(createdAt),
                createdAt,
                read: storedReadIds.has(id),
                href: buildFocusHref(id),
                targetHref: `/dashboard/conversations/${conversation.id}`,
                dismissible: false,
            })
        })
    }

    if (typeof profileData.creditsBalance === 'number' && profileData.creditsBalance < 5) {
        const id = 'low-credits'
        notifications.push({
            id,
            source: 'credits',
            type: 'credits',
            title: 'Credits faibles',
            message: `Il vous reste ${profileData.creditsBalance} credits.`,
            time: 'Maintenant',
            createdAt: now.toISOString(),
            read: storedReadIds.has(id),
            href: buildFocusHref(id),
            targetHref: '/dashboard/billing',
            dismissible: false,
        })
    }

    const { data: loggedNotifications } = await supabase
        .from('notification_log')
        .select('id, type, data, created_at, read')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)

    loggedNotifications?.forEach((notification) => {
        const id = `log-${notification.id}`
        const createdAt = notification.created_at

        notifications.push({
            id,
            source: 'notification_log',
            type: notification.type === 'broadcast_push' ? 'push' : 'info',
            title: getLogTitle(notification.type, notification.data),
            message: getLogMessage(notification.type, notification.data),
            time: formatBellTime(createdAt),
            createdAt,
            read: Boolean(notification.read) || storedReadIds.has(id),
            href: buildFocusHref(id),
            targetHref: getLogTargetHref(notification.data),
            notificationLogId: notification.id,
            dismissible: true,
        })
    })

    notifications.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

    return {
        notifications: notifications.slice(0, limit),
        profile: profileData,
    }
}

export async function markDashboardNotificationAsRead(notification: DashboardNotification) {
    markNotificationReadLocal(notification.id)

    if (notification.source !== 'notification_log' || !notification.notificationLogId) return

    try {
        const supabase = createClient()
        await supabase
            .from('notification_log')
            .update({ read: true })
            .eq('id', notification.notificationLogId)
    } catch (error) {
        console.error('Error marking notification as read:', error)
    }
}

export async function markAllDashboardNotificationsAsRead(notifications: DashboardNotification[]) {
    markNotificationsReadLocal(notifications.map((notification) => notification.id))

    const notificationLogIds = notifications
        .filter((notification) => notification.source === 'notification_log' && notification.notificationLogId)
        .map((notification) => notification.notificationLogId as string)

    if (notificationLogIds.length === 0) return

    try {
        const supabase = createClient()
        await supabase
            .from('notification_log')
            .update({ read: true })
            .in('id', notificationLogIds)
    } catch (error) {
        console.error('Error marking all notifications as read:', error)
    }
}

export async function deleteDashboardNotification(notification: DashboardNotification) {
    if (notification.source !== 'notification_log' || !notification.notificationLogId) return

    try {
        const supabase = createClient()
        await supabase
            .from('notification_log')
            .delete()
            .eq('id', notification.notificationLogId)
    } catch (error) {
        console.error('Error deleting notification:', error)
    }
}

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
    AlertCircle,
    AlertTriangle,
    Bell,
    Check,
    CheckCircle,
    Clock,
    CreditCard,
    type LucideIcon,
    Loader2,
    MessageSquare,
    RefreshCw,
    Settings,
    ShoppingCart,
    Trash2,
} from 'lucide-react'
import {
    type DashboardNotification,
    deleteDashboardNotification,
    fetchDashboardNotifications,
    markAllDashboardNotificationsAsRead,
    markDashboardNotificationAsRead,
} from '@/lib/notifications/user-notifications'

const typeConfig: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
    credits: { icon: CreditCard, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    order: { icon: ShoppingCart, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    info: { icon: MessageSquare, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    warning: { icon: AlertTriangle, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    success: { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    push: { icon: Bell, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    default: { icon: Bell, color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' },
}

export default function NotificationsPage() {
    const searchParams = useSearchParams()
    const focusedNotificationId = searchParams.get('notification')
    const [notifications, setNotifications] = useState<DashboardNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [preferences, setPreferences] = useState({
        push_enabled: true,
        email_enabled: true,
    })

    useEffect(() => {
        fetchNotifications()
        fetchPreferences()
    }, [])

    useEffect(() => {
        if (!focusedNotificationId || notifications.length === 0) return

        const focusedNotification = notifications.find((notification) => notification.id === focusedNotificationId)
        if (!focusedNotification) return

        if (!focusedNotification.read) {
            setNotifications((prev) =>
                prev.map((item) => item.id === focusedNotification.id ? { ...item, read: true } : item)
            )
            void markDashboardNotificationAsRead(focusedNotification)
        }

        const element = document.getElementById(`notification-${focusedNotificationId}`)
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
    }, [focusedNotificationId, notifications])

    const fetchNotifications = async () => {
        try {
            const result = await fetchDashboardNotifications(50)
            setNotifications(result.notifications)
        } catch (error) {
            console.error('Error fetching notifications:', error)
            setNotifications([])
        } finally {
            setLoading(false)
        }
    }

    const fetchPreferences = async () => {
        try {
            const response = await fetch('/api/notification-preferences')
            if (!response.ok) return

            const payload = await response.json()
            if (!payload.success) return

            setPreferences({
                push_enabled: payload.data?.push_enabled ?? true,
                email_enabled: payload.data?.email_new_order ?? true,
            })
        } catch (error) {
            console.error('Error fetching preferences:', error)
        }
    }

    const refresh = async () => {
        setRefreshing(true)
        await fetchNotifications()
        setRefreshing(false)
    }

    const markAsRead = async (id: string) => {
        const notification = notifications.find((item) => item.id === id)
        if (!notification) return

        setNotifications((prev) =>
            prev.map((item) => item.id === id ? { ...item, read: true } : item)
        )

        await markDashboardNotificationAsRead(notification)
    }

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
        await markAllDashboardNotificationsAsRead(notifications)
    }

    const deleteNotification = async (id: string) => {
        const notification = notifications.find((item) => item.id === id)
        if (!notification || !notification.dismissible) return

        setNotifications((prev) => prev.filter((item) => item.id !== id))
        await deleteDashboardNotification(notification)
    }

    const formatTimeAgo = (createdAt: string) => {
        const date = new Date(createdAt)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)

        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const dateLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

        if (minutes < 1) return `A l'instant - ${timeStr}`
        if (minutes < 60) return `Il y a ${minutes} min - ${timeStr}`
        if (hours < 24) return `Aujourd'hui a ${timeStr}`
        return `${dateLabel} a ${timeStr}`
    }

    const filteredNotifications = notifications.filter((notification) => {
        if (filter === 'unread' && notification.read) return false
        return true
    })

    const unreadCount = notifications.filter((notification) => !notification.read).length

    const cardStyle = {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        overflow: 'hidden' as const,
    }

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                <Loader2 style={{ width: 32, height: 32, color: '#10b981', animation: 'spin 1s linear infinite' }} />
            </div>
        )
    }

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 16px' }}>
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            <Bell style={{ width: 24, height: 24, color: 'white' }} />
                        </div>
                        <div>
                            <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', margin: 0 }}>
                                Notifications
                            </h1>
                            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                                {unreadCount > 0 ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Toutes lues'}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={refresh}
                        disabled={refreshing}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '10px 16px',
                            borderRadius: 10,
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            fontSize: 14,
                        }}
                    >
                        <RefreshCw style={{
                            width: 16,
                            height: 16,
                            animation: refreshing ? 'spin 1s linear infinite' : 'none',
                        }} />
                        Actualiser
                    </button>
                </div>
            </div>

            <div style={{ ...cardStyle, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button
                            onClick={() => setFilter('all')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                backgroundColor: filter === 'all' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                border: filter === 'all' ? '1px solid #10b981' : '1px solid transparent',
                                color: filter === 'all' ? '#10b981' : '#94a3b8',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 500,
                            }}
                        >
                            Toutes ({notifications.length})
                        </button>

                        <button
                            onClick={() => setFilter('unread')}
                            style={{
                                padding: '8px 16px',
                                borderRadius: 8,
                                backgroundColor: filter === 'unread' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                border: filter === 'unread' ? '1px solid #10b981' : '1px solid transparent',
                                color: filter === 'unread' ? '#10b981' : '#94a3b8',
                                cursor: 'pointer',
                                fontSize: 13,
                                fontWeight: 500,
                            }}
                        >
                            Non lues ({unreadCount})
                        </button>
                    </div>

                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '8px 14px',
                                borderRadius: 8,
                                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                border: 'none',
                                color: '#10b981',
                                cursor: 'pointer',
                                fontSize: 13,
                            }}
                        >
                            <Check style={{ width: 14, height: 14 }} />
                            Tout marquer lu
                        </button>
                    )}
                </div>
            </div>

            <div style={cardStyle}>
                {filteredNotifications.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                        <Bell style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.3 }} />
                        <p style={{ fontSize: 16, marginBottom: 8 }}>Aucune notification</p>
                        <p style={{ fontSize: 13 }}>
                            {filter === 'unread' ? 'Toutes vos notifications sont lues.' : 'Vous n avez pas encore de notifications.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        <AnimatePresence>
                            {filteredNotifications.map((notification, index) => {
                                const config = typeConfig[notification.type] || typeConfig.default
                                const Icon = config.icon
                                const isFocused = focusedNotificationId === notification.id

                                return (
                                    <motion.div
                                        key={notification.id}
                                        id={`notification-${notification.id}`}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: index * 0.03 }}
                                        style={{
                                            padding: '16px 20px',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 14,
                                            backgroundColor: isFocused
                                                ? 'rgba(16, 185, 129, 0.08)'
                                                : notification.read ? 'transparent' : 'rgba(16, 185, 129, 0.03)',
                                            cursor: 'pointer',
                                            boxShadow: isFocused ? 'inset 3px 0 0 #10b981' : 'none',
                                        }}
                                        onClick={() => markAsRead(notification.id)}
                                    >
                                        <div style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 10,
                                            backgroundColor: config.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                        }}>
                                            <Icon style={{ width: 20, height: 20, color: config.color }} />
                                        </div>

                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                                                <span style={{
                                                    fontSize: 15,
                                                    fontWeight: 600,
                                                    color: 'white',
                                                }}>
                                                    {notification.title}
                                                </span>
                                                {!notification.read && (
                                                    <span style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        backgroundColor: '#10b981',
                                                    }} />
                                                )}
                                            </div>

                                            <p style={{
                                                fontSize: 14,
                                                color: '#94a3b8',
                                                margin: 0,
                                                marginBottom: 6,
                                                lineHeight: 1.6,
                                            }}>
                                                {notification.message}
                                            </p>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                                <span style={{
                                                    fontSize: 12,
                                                    color: '#64748b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4,
                                                }}>
                                                    <Clock style={{ width: 12, height: 12 }} />
                                                    {formatTimeAgo(notification.createdAt)}
                                                </span>

                                                {notification.targetHref && notification.targetHref !== '/dashboard/notifications' && (
                                                    <Link
                                                        href={notification.targetHref}
                                                        onClick={(event) => event.stopPropagation()}
                                                        style={{
                                                            fontSize: 12,
                                                            color: '#10b981',
                                                            textDecoration: 'none',
                                                            fontWeight: 500,
                                                        }}
                                                    >
                                                        Ouvrir
                                                    </Link>
                                                )}
                                            </div>
                                        </div>

                                        {notification.dismissible && (
                                            <button
                                                onClick={(event) => {
                                                    event.stopPropagation()
                                                    void deleteNotification(notification.id)
                                                }}
                                                style={{
                                                    padding: 8,
                                                    borderRadius: 8,
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    color: '#64748b',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                <Trash2 style={{ width: 16, height: 16 }} />
                                            </button>
                                        )}
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            <div style={{ ...cardStyle, marginTop: 24, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Settings style={{ width: 20, height: 20, color: '#64748b' }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>
                        Parametres de notifications
                    </h3>
                </div>

                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                    Configurez vos preferences de notifications dans les{' '}
                    <Link href="/dashboard/settings" style={{ color: '#10b981' }}>parametres</Link>.
                </p>

                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        backgroundColor: preferences.push_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: preferences.push_enabled ? '#10b981' : '#ef4444',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}>
                        {preferences.push_enabled
                            ? <CheckCircle style={{ width: 14, height: 14 }} />
                            : <AlertCircle style={{ width: 14, height: 14 }} />}
                        Push {preferences.push_enabled ? 'activees' : 'desactivees'}
                    </div>

                    <div style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        backgroundColor: preferences.email_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: preferences.email_enabled ? '#10b981' : '#ef4444',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                    }}>
                        {preferences.email_enabled
                            ? <CheckCircle style={{ width: 14, height: 14 }} />
                            : <AlertCircle style={{ width: 14, height: 14 }} />}
                        Email {preferences.email_enabled ? 'actives' : 'desactives'}
                    </div>
                </div>
            </div>
        </div>
    )
}


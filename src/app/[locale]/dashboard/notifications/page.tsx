'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bell, AlertCircle, CheckCircle, Info,
    Search, RefreshCw, Loader2, Trash2,
    Check, Settings, Bot, CreditCard,
    AlertTriangle, Clock, ShoppingCart,
    MessageSquare, Calendar, Zap, Eye
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface UserNotification {
    id: string
    type: string
    title: string
    message: string
    read: boolean
    created_at: string
    data?: Record<string, any>
}

const typeConfig: Record<string, { icon: any; color: string; bg: string }> = {
    low_credits: { icon: CreditCard, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    credits_depleted: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    new_order: { icon: ShoppingCart, color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    new_conversation: { icon: MessageSquare, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
    new_booking: { icon: Calendar, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' },
    agent_status_change: { icon: Bot, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)' },
    subscription_expiring: { icon: Zap, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' },
    payment_received: { icon: CheckCircle, color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' },
    default: { icon: Bell, color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
}

export default function NotificationsPage() {
    const [notifications, setNotifications] = useState<UserNotification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread'>('all')
    const [preferences, setPreferences] = useState({
        push_enabled: true,
        email_enabled: true
    })

    useEffect(() => {
        fetchNotifications()
        fetchPreferences()
    }, [])

    const fetchNotifications = async () => {
        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            // Fetch from notification_log table
            const { data, error } = await supabase
                .from('notification_log')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.error('Error fetching notifications:', error)
                // Generate sample notifications if table doesn't exist
                generateSampleNotifications()
                return
            }

            if (data && data.length > 0) {
                setNotifications(data.map(n => ({
                    id: n.id,
                    type: n.type,
                    title: getNotificationTitle(n.type),
                    message: n.message || getDefaultMessage(n.type),
                    read: n.read || false,
                    created_at: n.created_at,
                    data: n.data
                })))
            } else {
                generateSampleNotifications()
            }
        } catch (err) {
            console.error('Error:', err)
            generateSampleNotifications()
        } finally {
            setLoading(false)
        }
    }

    const generateSampleNotifications = () => {
        // Show empty state or sample data
        setNotifications([])
    }

    const fetchPreferences = async () => {
        try {
            const res = await fetch('/api/notifications/preferences')
            if (res.ok) {
                const data = await res.json()
                if (data.success) {
                    setPreferences({
                        push_enabled: data.data?.push_low_credits ?? true,
                        email_enabled: data.data?.email_low_credits ?? true
                    })
                }
            }
        } catch (err) {
            console.error('Error fetching preferences:', err)
        }
    }

    const getNotificationTitle = (type: string): string => {
        const titles: Record<string, string> = {
            low_credits: 'Crédits bas',
            credits_depleted: 'Crédits épuisés',
            new_order: 'Nouvelle commande',
            new_conversation: 'Nouvelle conversation',
            new_booking: 'Nouvelle réservation',
            agent_status_change: 'Statut agent modifié',
            subscription_expiring: 'Abonnement bientôt expiré',
            payment_received: 'Paiement reçu'
        }
        return titles[type] || 'Notification'
    }

    const getDefaultMessage = (type: string): string => {
        const messages: Record<string, string> = {
            low_credits: 'Votre solde de crédits est bas. Rechargez pour continuer.',
            credits_depleted: 'Vos crédits sont épuisés. Rechargez maintenant.',
            new_order: 'Vous avez reçu une nouvelle commande.',
            new_conversation: 'Une nouvelle conversation a démarré.',
            new_booking: 'Une nouvelle réservation a été effectuée.',
            agent_status_change: 'Le statut de votre agent a changé.',
            subscription_expiring: 'Votre abonnement expire bientôt.',
            payment_received: 'Un paiement a été reçu.'
        }
        return messages[type] || 'Vous avez une nouvelle notification.'
    }

    const refresh = async () => {
        setRefreshing(true)
        await fetchNotifications()
        setRefreshing(false)
    }

    const markAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, read: true } : n
        ))

        // Update in database
        try {
            const supabase = createClient()
            await supabase
                .from('notification_log')
                .update({ read: true })
                .eq('id', id)
        } catch (err) {
            console.error('Error marking as read:', err)
        }
    }

    const markAllAsRead = async () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                await supabase
                    .from('notification_log')
                    .update({ read: true })
                    .eq('user_id', user.id)
            }
        } catch (err) {
            console.error('Error marking all as read:', err)
        }
    }

    const deleteNotification = async (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))

        try {
            const supabase = createClient()
            await supabase
                .from('notification_log')
                .delete()
                .eq('id', id)
        } catch (err) {
            console.error('Error deleting notification:', err)
        }
    }

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)

        const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
        const dateLabel = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

        if (minutes < 1) return `À l'instant · ${timeStr}`
        if (minutes < 60) return `Il y a ${minutes}min · ${timeStr}`
        if (hours < 24) return `Aujourd'hui à ${timeStr}`
        return `${dateLabel} à ${timeStr}`
    }

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread' && n.read) return false
        return true
    })

    const unreadCount = notifications.filter(n => !n.read).length

    const cardStyle = {
        backgroundColor: '#0f172a',
        borderRadius: 16,
        border: '1px solid rgba(148, 163, 184, 0.1)',
        overflow: 'hidden'
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
            {/* Header */}
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
                            justifyContent: 'center'
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
                            fontSize: 14
                        }}
                    >
                        <RefreshCw style={{
                            width: 16,
                            height: 16,
                            animation: refreshing ? 'spin 1s linear infinite' : 'none'
                        }} />
                        Actualiser
                    </button>
                </div>
            </div>

            {/* Filters */}
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
                                fontWeight: 500
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
                                fontWeight: 500
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
                                fontSize: 13
                            }}
                        >
                            <Check style={{ width: 14, height: 14 }} />
                            Tout marquer lu
                        </button>
                    )}
                </div>
            </div>

            {/* Notifications List */}
            <div style={cardStyle}>
                {filteredNotifications.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                        <Bell style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.3 }} />
                        <p style={{ fontSize: 16, marginBottom: 8 }}>Aucune notification</p>
                        <p style={{ fontSize: 13 }}>
                            {filter === 'unread' ? 'Toutes vos notifications sont lues.' : 'Vous n\'avez pas encore de notifications.'}
                        </p>
                    </div>
                ) : (
                    <div>
                        <AnimatePresence>
                            {filteredNotifications.map((notif, idx) => {
                                const config = typeConfig[notif.type] || typeConfig.default
                                const Icon = config.icon

                                return (
                                    <motion.div
                                        key={notif.id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        transition={{ delay: idx * 0.03 }}
                                        style={{
                                            padding: '16px 20px',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 14,
                                            backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.03)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => markAsRead(notif.id)}
                                    >
                                        {/* Icon */}
                                        <div style={{
                                            width: 44,
                                            height: 44,
                                            borderRadius: 10,
                                            backgroundColor: config.bg,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            <Icon style={{ width: 20, height: 20, color: config.color }} />
                                        </div>

                                        {/* Content */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <span style={{
                                                    fontSize: 15,
                                                    fontWeight: 600,
                                                    color: 'white'
                                                }}>
                                                    {notif.title}
                                                </span>
                                                {!notif.read && (
                                                    <span style={{
                                                        width: 8,
                                                        height: 8,
                                                        borderRadius: '50%',
                                                        backgroundColor: '#10b981'
                                                    }} />
                                                )}
                                            </div>
                                            <p style={{
                                                fontSize: 14,
                                                color: '#94a3b8',
                                                margin: 0,
                                                marginBottom: 6
                                            }}>
                                                {notif.message}
                                            </p>
                                            <span style={{
                                                fontSize: 12,
                                                color: '#64748b',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4
                                            }}>
                                                <Clock style={{ width: 12, height: 12 }} />
                                                {formatTimeAgo(notif.created_at)}
                                            </span>
                                        </div>

                                        {/* Actions */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                deleteNotification(notif.id)
                                            }}
                                            style={{
                                                padding: 8,
                                                borderRadius: 8,
                                                backgroundColor: 'transparent',
                                                border: 'none',
                                                color: '#64748b',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <Trash2 style={{ width: 16, height: 16 }} />
                                        </button>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>

            {/* Notification Settings Card */}
            <div style={{ ...cardStyle, marginTop: 24, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Settings style={{ width: 20, height: 20, color: '#64748b' }} />
                    <h3 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>
                        Paramètres de notifications
                    </h3>
                </div>
                <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                    Configurez vos préférences de notifications dans les{' '}
                    <a href="/dashboard/settings" style={{ color: '#10b981' }}>paramètres</a>.
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
                        gap: 6
                    }}>
                        {preferences.push_enabled ? <CheckCircle style={{ width: 14, height: 14 }} /> : <AlertCircle style={{ width: 14, height: 14 }} />}
                        Push {preferences.push_enabled ? 'activées' : 'désactivées'}
                    </div>
                    <div style={{
                        padding: '8px 14px',
                        borderRadius: 8,
                        backgroundColor: preferences.email_enabled ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: preferences.email_enabled ? '#10b981' : '#ef4444',
                        fontSize: 13,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                    }}>
                        {preferences.email_enabled ? <CheckCircle style={{ width: 14, height: 14 }} /> : <AlertCircle style={{ width: 14, height: 14 }} />}
                        Email {preferences.email_enabled ? 'activées' : 'désactivées'}
                    </div>
                </div>
            </div>
        </div>
    )
}

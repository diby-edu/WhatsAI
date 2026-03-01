'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Bell, AlertCircle, CheckCircle, Info, XCircle,
    Search, Filter, RefreshCw, Loader2, Trash2,
    Check, Settings, Users, Bot, CreditCard, Wallet,
    AlertTriangle, Clock, Eye, EyeOff, ChevronDown
} from 'lucide-react'

interface Notification {
    id: string
    type: 'agent_disconnect' | 'low_credits' | 'high_merchant_balance' | 'system'
    severity: 'critical' | 'warning' | 'info'
    label: string
    message: string
    resource_id?: string
    days_since_active: number
    read: boolean
    created_at: string
}

const typeConfig: Record<string, { icon: any; color: string; bg: string; label: string }> = {
    agent_disconnect: {
        icon: Bot,
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.15)',
        label: 'Agent déconnecté'
    },
    low_credits: {
        icon: CreditCard,
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.15)',
        label: 'Crédits bas'
    },
    high_merchant_balance: {
        icon: Wallet,
        color: '#3b82f6',
        bg: 'rgba(59, 130, 246, 0.15)',
        label: 'Solde à reverser'
    },
    system: {
        icon: Info,
        color: '#8b5cf6',
        bg: 'rgba(139, 92, 246, 0.15)',
        label: 'Système'
    }
}

const severityConfig: Record<string, { color: string; bg: string; label: string }> = {
    critical: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Critique' },
    warning: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', label: 'Attention' },
    info: { color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', label: 'Info' }
}

export default function AdminNotificationsPage() {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const [filter, setFilter] = useState<'all' | 'unread' | 'critical' | 'warning'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showFilters, setShowFilters] = useState(false)

    useEffect(() => {
        fetchNotifications()
    }, [])

    const fetchNotifications = async () => {
        try {
            const res = await fetch('/api/admin/alerts')
            const json = await res.json()

            if (json.success && json.data) {
                const mapped: Notification[] = json.data.map((alert: any, idx: number) => ({
                    id: alert.resource_id || `notif-${idx}`,
                    type: alert.type || 'system',
                    severity: alert.severity || 'info',
                    label: alert.label,
                    message: alert.message,
                    resource_id: alert.resource_id,
                    days_since_active: alert.days_since_active || 0,
                    read: false,
                    created_at: new Date().toISOString()
                }))
                setNotifications(mapped)
            }
        } catch (err) {
            console.error('Error fetching notifications:', err)
        } finally {
            setLoading(false)
        }
    }

    const refresh = async () => {
        setRefreshing(true)
        await fetchNotifications()
        setRefreshing(false)
    }

    const markAsRead = (id: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, read: true } : n
        ))
    }

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    }

    const deleteNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id))
    }

    const filteredNotifications = notifications.filter(n => {
        if (filter === 'unread' && n.read) return false
        if (filter === 'critical' && n.severity !== 'critical') return false
        if (filter === 'warning' && n.severity !== 'warning') return false
        if (searchQuery && !n.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !n.message.toLowerCase().includes(searchQuery.toLowerCase())) return false
        return true
    })

    const unreadCount = notifications.filter(n => !n.read).length
    const criticalCount = notifications.filter(n => n.severity === 'critical').length

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
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: 32 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 12 }}>
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
                            <h1 style={{ fontSize: 28, fontWeight: 700, color: 'white', margin: 0 }}>
                                Notifications
                            </h1>
                            <p style={{ fontSize: 14, color: '#64748b', margin: 0 }}>
                                Centre de notifications et alertes système
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

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ ...cardStyle, padding: 20 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: 'rgba(16, 185, 129, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Bell style={{ width: 20, height: 20, color: '#10b981' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{notifications.length}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>Total</div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{ ...cardStyle, padding: 20 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: 'rgba(59, 130, 246, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <EyeOff style={{ width: 20, height: 20, color: '#3b82f6' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{unreadCount}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>Non lues</div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    style={{ ...cardStyle, padding: 20 }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                            width: 44,
                            height: 44,
                            borderRadius: 10,
                            backgroundColor: 'rgba(239, 68, 68, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <AlertTriangle style={{ width: 20, height: 20, color: '#ef4444' }} />
                        </div>
                        <div>
                            <div style={{ fontSize: 24, fontWeight: 700, color: 'white' }}>{criticalCount}</div>
                            <div style={{ fontSize: 13, color: '#64748b' }}>Critiques</div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Filters & Search */}
            <div style={{ ...cardStyle, padding: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    {/* Search */}
                    <div style={{
                        flex: 1,
                        minWidth: 200,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '10px 14px',
                        borderRadius: 10,
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <Search style={{ width: 18, height: 18, color: '#64748b' }} />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            style={{
                                flex: 1,
                                background: 'none',
                                border: 'none',
                                outline: 'none',
                                color: 'white',
                                fontSize: 14
                            }}
                        />
                    </div>

                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: 8 }}>
                        {[
                            { key: 'all', label: 'Toutes' },
                            { key: 'unread', label: 'Non lues' },
                            { key: 'critical', label: 'Critiques' },
                            { key: 'warning', label: 'Attention' }
                        ].map(f => (
                            <button
                                key={f.key}
                                onClick={() => setFilter(f.key as any)}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: 8,
                                    backgroundColor: filter === f.key ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                    border: filter === f.key ? '1px solid #10b981' : '1px solid transparent',
                                    color: filter === f.key ? '#10b981' : '#94a3b8',
                                    cursor: 'pointer',
                                    fontSize: 13,
                                    fontWeight: 500
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Mark All Read */}
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
                <div style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'white', margin: 0 }}>
                        Alertes système
                    </h2>
                    <span style={{ fontSize: 13, color: '#64748b' }}>
                        {filteredNotifications.length} notification{filteredNotifications.length > 1 ? 's' : ''}
                    </span>
                </div>

                {filteredNotifications.length === 0 ? (
                    <div style={{ padding: 60, textAlign: 'center', color: '#64748b' }}>
                        <Bell style={{ width: 48, height: 48, marginBottom: 16, opacity: 0.3 }} />
                        <p style={{ fontSize: 16, marginBottom: 8 }}>Aucune notification</p>
                        <p style={{ fontSize: 13 }}>Tout est en ordre !</p>
                    </div>
                ) : (
                    <div>
                        <AnimatePresence>
                            {filteredNotifications.map((notif, idx) => {
                                const config = typeConfig[notif.type] || typeConfig.system
                                const sevConfig = severityConfig[notif.severity] || severityConfig.info
                                const Icon = config.icon

                                return (
                                    <motion.div
                                        key={notif.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        transition={{ delay: idx * 0.05 }}
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
                                                    {notif.label}
                                                </span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 6,
                                                    backgroundColor: sevConfig.bg,
                                                    color: sevConfig.color,
                                                    fontSize: 11,
                                                    fontWeight: 600
                                                }}>
                                                    {sevConfig.label}
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
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                <span style={{
                                                    fontSize: 12,
                                                    color: '#64748b',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 4
                                                }}>
                                                    <Clock style={{ width: 12, height: 12 }} />
                                                    {notif.days_since_active > 0 ? `${Math.round(notif.days_since_active)}j` : 'Maintenant'}
                                                </span>
                                                <span style={{
                                                    padding: '2px 8px',
                                                    borderRadius: 4,
                                                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                                    color: '#64748b',
                                                    fontSize: 11
                                                }}>
                                                    {config.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    )
}

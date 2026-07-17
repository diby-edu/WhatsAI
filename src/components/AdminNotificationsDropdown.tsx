'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, AlertCircle, X } from 'lucide-react'

interface Notification {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    time: string
    read: boolean
}

function getNotifIcon(type: string) {
    switch (type) {
        case 'success': return <Check style={{ width: 16, height: 16, color: '#4ade80' }} />
        case 'warning': return <AlertCircle style={{ width: 16, height: 16, color: '#fbbf24' }} />
        case 'error': return <AlertCircle style={{ width: 16, height: 16, color: '#f87171' }} />
        default: return <Bell style={{ width: 16, height: 16, color: '#60a5fa' }} />
    }
}

function getNotifBg(type: string) {
    switch (type) {
        case 'success': return 'rgba(34, 197, 94, 0.15)'
        case 'warning': return 'rgba(245, 158, 11, 0.15)'
        case 'error': return 'rgba(239, 68, 68, 0.15)'
        default: return 'rgba(59, 130, 246, 0.15)'
    }
}

interface AdminNotificationsDropdownProps {
    variant: 'mobile' | 'desktop'
    open: boolean
    notifications: Notification[]
    unreadCount: number
    onMarkAllRead: () => void
    onClose: () => void
    viewAllHref?: string
}

export function AdminNotificationsDropdown({
    variant,
    open,
    notifications,
    unreadCount,
    onMarkAllRead,
    onClose,
    viewAllHref = '/admin/notifications',
}: AdminNotificationsDropdownProps) {
    if (variant === 'mobile') {
        return (
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="mobile-notification-panel"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'fixed',
                            top: 64,
                            left: 0,
                            right: 0,
                            zIndex: 200,
                            background: '#1e293b',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.15)',
                            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                            maxHeight: 'calc(100vh - 64px)',
                            overflowY: 'auto'
                        }}
                    >
                        <div style={{
                            padding: '14px 20px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ color: 'white', fontWeight: 600, margin: 0, fontSize: 16 }}>Notifications</h3>
                            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                                {unreadCount > 0 && (
                                    <button onClick={onMarkAllRead} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: 13, cursor: 'pointer' }}>
                                        Tout marquer lu
                                    </button>
                                )}
                                <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                                    <X style={{ width: 18, height: 18, color: '#64748b' }} />
                                </button>
                            </div>
                        </div>
                        {notifications.length === 0 ? (
                            <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
                                <Bell style={{ width: 32, height: 32, marginBottom: 12, opacity: 0.5 }} />
                                <p>Aucune notification</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div key={notif.id} style={{
                                    padding: '14px 20px',
                                    borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                    display: 'flex',
                                    gap: 12,
                                    backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)'
                                }}>
                                    <div style={{
                                        width: 36, height: 36, borderRadius: 10,
                                        backgroundColor: getNotifBg(notif.type),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                    }}>
                                        {getNotifIcon(notif.type)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 14, fontWeight: 500, color: 'white', marginBottom: 2 }}>{notif.title}</div>
                                        <div style={{ fontSize: 13, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notif.message}</div>
                                    </div>
                                    <div style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>{notif.time}</div>
                                </div>
                            ))
                        )}
                        <Link
                            href={viewAllHref}
                            onClick={onClose}
                            style={{
                                display: 'block', padding: '14px 20px',
                                borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                                textAlign: 'center', color: '#10b981',
                                fontSize: 13, fontWeight: 500, textDecoration: 'none'
                            }}
                        >
                            Voir toutes les notifications
                        </Link>
                    </motion.div>
                )}
            </AnimatePresence>
        )
    }

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    style={{
                        position: 'absolute',
                        top: 50,
                        right: 0,
                        width: 380,
                        maxHeight: 480,
                        backgroundColor: '#1e293b',
                        border: '1px solid rgba(148, 163, 184, 0.1)',
                        borderRadius: 16,
                        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                        overflow: 'hidden',
                        zIndex: 9999
                    }}
                >
                    <div style={{
                        padding: '16px 20px',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <h3 style={{ color: 'white', fontWeight: 600, margin: 0 }}>
                            Notifications
                        </h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={onMarkAllRead}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#34d399',
                                    fontSize: 13,
                                    cursor: 'pointer'
                                }}
                            >
                                Tout marquer lu
                            </button>
                        )}
                    </div>

                    <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                        {notifications.length === 0 ? (
                            <div style={{
                                padding: 40,
                                textAlign: 'center',
                                color: '#64748b'
                            }}>
                                <Bell style={{ width: 32, height: 32, marginBottom: 12, opacity: 0.5 }} />
                                <p>Aucune notification</p>
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    style={{
                                        padding: '14px 20px',
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                        display: 'flex',
                                        gap: 12,
                                        backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)'
                                    }}
                                >
                                    <div style={{
                                        width: 36,
                                        height: 36,
                                        borderRadius: 10,
                                        backgroundColor: getNotifBg(notif.type),
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        {getNotifIcon(notif.type)}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{
                                            fontSize: 14,
                                            fontWeight: 500,
                                            color: 'white',
                                            marginBottom: 2
                                        }}>
                                            {notif.title}
                                        </div>
                                        <div style={{
                                            fontSize: 13,
                                            color: '#94a3b8',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis'
                                        }}>
                                            {notif.message}
                                        </div>
                                    </div>
                                    <div style={{
                                        fontSize: 12,
                                        color: '#64748b',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {notif.time}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                    {/* Footer link */}
                    <Link
                        href={viewAllHref}
                        onClick={onClose}
                        style={{
                            display: 'block',
                            padding: '14px 20px',
                            borderTop: '1px solid rgba(148, 163, 184, 0.1)',
                            textAlign: 'center',
                            color: '#10b981',
                            fontSize: 13,
                            fontWeight: 500,
                            textDecoration: 'none'
                        }}
                    >
                        Voir toutes les notifications
                    </Link>
                </motion.div>
            )}
        </AnimatePresence>
    )
}

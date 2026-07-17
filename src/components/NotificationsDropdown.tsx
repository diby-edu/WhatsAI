'use client'

import type { RefObject } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ShoppingCart, Coins, Check, AlertCircle, MessageCircle } from 'lucide-react'
import type { DashboardNotification } from '@/lib/notifications/user-notifications'

function getNotifIcon(type: string) {
    switch (type) {
        case 'order': return <ShoppingCart style={{ width: 16, height: 16, color: '#4ade80' }} />
        case 'credits': return <Coins style={{ width: 16, height: 16, color: '#fbbf24' }} />
        case 'success': return <Check style={{ width: 16, height: 16, color: '#4ade80' }} />
        case 'warning': return <AlertCircle style={{ width: 16, height: 16, color: '#fbbf24' }} />
        default: return <MessageCircle style={{ width: 16, height: 16, color: '#60a5fa' }} />
    }
}

function getNotifBg(type: string) {
    switch (type) {
        case 'order': return 'rgba(34, 197, 94, 0.15)'
        case 'credits': return 'rgba(245, 158, 11, 0.15)'
        case 'success': return 'rgba(34, 197, 94, 0.15)'
        case 'warning': return 'rgba(245, 158, 11, 0.15)'
        default: return 'rgba(59, 130, 246, 0.15)'
    }
}

interface NotificationsDropdownProps {
    variant: 'mobile' | 'desktop'
    open: boolean
    notifications: DashboardNotification[]
    unreadCount: number
    onMarkAllRead: () => void
    onItemClick: (notification: DashboardNotification) => void
    onClose: () => void
    containerRef?: RefObject<HTMLDivElement | null>
    viewAllHref?: string
}

export function NotificationsDropdown({
    variant,
    open,
    notifications,
    unreadCount,
    onMarkAllRead,
    onItemClick,
    onClose,
    containerRef,
    viewAllHref = '/dashboard/notifications',
}: NotificationsDropdownProps) {
    if (variant === 'mobile') {
        return (
            <AnimatePresence>
                {open && (
                    <motion.div
                        ref={containerRef}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        style={{
                            position: 'fixed',
                            top: 60,
                            left: 16,
                            right: 16,
                            zIndex: 60,
                            maxHeight: 400,
                            backgroundColor: '#1e293b',
                            border: '1px solid rgba(148, 163, 184, 0.1)',
                            borderRadius: 16,
                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                            overflow: 'hidden'
                        }}
                    >
                        <div style={{
                            padding: '14px 16px',
                            borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <h3 style={{ color: 'white', fontWeight: 600, margin: 0, fontSize: 15 }}>
                                Notifications
                            </h3>
                            {unreadCount > 0 && (
                                <button
                                    onClick={onMarkAllRead}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#34d399',
                                        fontSize: 12,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Tout marquer lu
                                </button>
                            )}
                        </div>
                        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                            {notifications.length === 0 ? (
                                <div style={{ padding: 30, textAlign: 'center', color: '#64748b' }}>
                                    <Bell style={{ width: 28, height: 28, marginBottom: 8, opacity: 0.5 }} />
                                    <p style={{ margin: 0, fontSize: 13 }}>Aucune notification</p>
                                </div>
                            ) : (
                                notifications.map((notif) => (
                                    <button
                                        key={notif.id}
                                        onClick={() => onItemClick(notif)}
                                        style={{
                                            padding: '12px 16px',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                            display: 'flex',
                                            gap: 10,
                                            backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                                            width: '100%',
                                            border: 'none',
                                            cursor: 'pointer',
                                            textAlign: 'left'
                                        }}
                                    >
                                        <div style={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: 8,
                                            backgroundColor: getNotifBg(notif.type),
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {getNotifIcon(notif.type)}
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 13, fontWeight: 500, color: 'white' }}>
                                                {notif.title}
                                            </div>
                                            <div style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {notif.message}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>
                                            {notif.time}
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                        {/* Footer link */}
                        <Link
                            href={viewAllHref}
                            onClick={onClose}
                            style={{
                                display: 'block',
                                padding: '12px 16px',
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
                        width: 360,
                        maxHeight: 450,
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

                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
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
                                <button
                                    key={notif.id}
                                    onClick={() => onItemClick(notif)}
                                    style={{
                                        padding: '14px 20px',
                                        borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                        display: 'flex',
                                        gap: 12,
                                        backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)',
                                        width: '100%',
                                        border: 'none',
                                        cursor: 'pointer',
                                        textAlign: 'left'
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
                                </button>
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

'use client'

import { useCallback, useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    Users,
    Bot,
    BookOpen,
    MessagesSquare,
    CreditCard,
    Settings,
    ChevronLeft,
    ChevronRight,
    Menu,
    LogOut,
    Bell,
    Search,
    Shield,
    BarChart3,
    FileText,
    Gauge,
    X,
    Zap,
    Activity,
    TestTube2,
    Check,
    AlertCircle,
    User as UserIcon,
    MessageSquare,
    DollarSign,
    Package,
    ShoppingCart,
    Calendar,
    ToggleRight,
    Send,
    Wallet,
    Download,
    Clock,
    Code2,
    Target,
    Timer,
    Mail,
    SlidersHorizontal,
    Webhook,
    Gift
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { useNativeDeviceTokenSync } from '@/hooks/useNativeDeviceTokenSync'
import { unregisterCurrentDeviceToken } from '@/lib/notifications/device-token-client'

interface AdminNavItem { href: string; label: string; icon: ElementType }
interface AdminGroup { label?: string; items: AdminNavItem[] }

const adminGroups: AdminGroup[] = [
    {
        items: [
            { href: '/admin', label: 'Vue d\'ensemble', icon: Gauge },
        ]
    },
    {
        label: 'CLIENTS',
        items: [
            { href: '/admin/users', label: 'Utilisateurs', icon: Users },
            { href: '/admin/payments', label: 'Paiements', icon: CreditCard },
            { href: '/admin/payouts', label: 'Reversements', icon: Wallet },
        ]
    },
    {
        label: 'PRODUIT',
        items: [
            { href: '/admin/agents', label: 'Agents IA', icon: Bot },
            { href: '/admin/knowledge', label: 'Bases de connaissances', icon: BookOpen },
            { href: '/admin/conversations', label: 'Conversations', icon: MessagesSquare },
            { href: '/admin/leads', label: 'Leads', icon: Target },
            { href: '/admin/orders', label: 'Commandes', icon: ShoppingCart },
            { href: '/admin/bookings', label: 'Réservations', icon: Calendar },
        ]
    },
    {
        label: 'DIFFUSION',
        items: [
            { href: '/admin/broadcasts', label: 'Broadcasts', icon: Send },
            { href: '/admin/notifications', label: 'Notifications', icon: Bell },
        ]
    },
    {
        label: 'CROISSANCE',
        items: [
            { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
            { href: '/admin/referrals', label: 'Parrainage', icon: Gift },
            { href: '/admin/features', label: 'Feature Flags', icon: ToggleRight },
        ]
    },
    {
        label: 'OPÉRATIONS',
        items: [
            { href: '/admin/cron', label: 'Tâches planifiées', icon: Timer },
            { href: '/admin/emails', label: 'Emails transactionnels', icon: Mail },
            { href: '/admin/webhooks', label: 'Webhooks', icon: Webhook },
            { href: '/admin/audit-logs', label: 'Audit Trail', icon: FileText },
            { href: '/admin/logs', label: 'Logs Activité', icon: Clock },
            { href: '/admin/api-monitoring', label: 'API Monitoring', icon: Code2 },
            { href: '/admin/diagnostics', label: 'Diagnostic', icon: Activity },
            { href: '/admin/exports', label: 'Exports & Rapports', icon: Download },
        ]
    },
    {
        label: 'CONFIGURATION',
        items: [
            { href: '/admin/plans', label: 'Plans', icon: Zap },
            { href: '/admin/credit-packs', label: 'Packs de Crédits', icon: Package },
            { href: '/admin/quotas', label: 'Quotas & Limites', icon: SlidersHorizontal },
            { href: '/admin/settings', label: 'Paramètres', icon: Settings },
        ]
    },
]

interface Notification {
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    title: string
    message: string
    time: string
    read: boolean
}

export default function AdminLayout({
    children,
}: {
    children: ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const isNativeApp = useNativeDeviceTokenSync()

    // Handle Android hardware back button
    useAndroidBackButton()

    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [adminEmail, setAdminEmail] = useState('admin@wazzapai.com')
    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [searchQuery, setSearchQuery] = useState('')
    const [showSearchResults, setShowSearchResults] = useState(false)
    const [sessionTimeoutHours, setSessionTimeoutHours] = useState<number | null>(null)
    const notifRef = useRef<HTMLDivElement>(null)
    const searchRef = useRef<HTMLDivElement>(null)
    const logoutInProgressRef = useRef(false)

    // Lock body scroll when mobile menu is open (prevents background page scrolling)
    useEffect(() => {
        if (mobileMenuOpen) {
            document.body.style.overflow = 'hidden'
            document.body.style.touchAction = 'none'
        } else {
            document.body.style.overflow = ''
            document.body.style.touchAction = ''
        }
        return () => {
            document.body.style.overflow = ''
            document.body.style.touchAction = ''
        }
    }, [mobileMenuOpen])

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    useEffect(() => {
        const loadRuntimeConfig = async () => {
            try {
                const res = await fetch('/api/public/runtime-config')
                const json = await res.json()
                if (json.success && json.data && Number(json.data.sessionTimeout) > 0) {
                    setSessionTimeoutHours(Number(json.data.sessionTimeout))
                }
            } catch (err) {
                console.error('Failed to load session timeout:', err)
            }
        }

        loadRuntimeConfig()
    }, [])

    // Fetch admin email + CSEC-3 : 2e ligne de défense côté client. Le middleware
    // (src/proxy.ts) protège déjà les routes en environnement Next serveur, mais
    // cette page peut aussi tourner en export statique / app native Capacitor où
    // le middleware ne s'exécute jamais — ce garde devient alors la seule barrière.
    useEffect(() => {
        let cancelled = false
        const fetchAdminEmailAndCheckRole = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                if (!cancelled) router.replace('/login')
                return
            }
            if (user.email && !cancelled) {
                setAdminEmail(user.email)
            }
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single()
            const role = String(profile?.role || '').toLowerCase()
            if (!cancelled && role !== 'admin' && role !== 'support') {
                router.replace('/dashboard')
            }
        }
        fetchAdminEmailAndCheckRole()
        return () => { cancelled = true }
    }, [router])

    // Fetch real notifications
    const formatTimeAgo = (date: Date) => {
        const now = new Date()
        const diff = now.getTime() - date.getTime()
        const minutes = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)

        if (minutes < 1) return 'À l\'instant'
        if (minutes < 60) return `Il y a ${minutes}min`
        if (hours < 24) return `Il y a ${hours}h`
        return `Il y a ${days}j`
    }

    const NOTIF_READ_KEY = 'admin_bell_read_ids'
    const getReadIds = (): Set<string> => {
        try { return new Set(JSON.parse(localStorage.getItem(NOTIF_READ_KEY) || '[]')) } catch { return new Set() }
    }
    const saveReadIds = (ids: Set<string>) => {
        try { localStorage.setItem(NOTIF_READ_KEY, JSON.stringify([...ids])) } catch { }
    }

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch('/api/admin/alerts')
                const json = await res.json()

                if (json.success && json.data) {
                    const readIds = getReadIds()
                    const mappedNotifs: Notification[] = json.data.map((alert: any) => {
                        // Build stable ID from type + resource_id (view has no 'id' column)
                        const stableId = alert.type && alert.resource_id
                            ? `${alert.type}_${alert.resource_id}`
                            : (alert.id || `${alert.message}_${alert.label}`)
                        return {
                            id: stableId,
                            type: alert.severity === 'critical' ? 'error' : 'warning',
                            title: alert.label,
                            message: alert.message,
                            time: `${alert.days_since_active}j`,
                            read: readIds.has(stableId)
                        }
                    })
                    setNotifications(mappedNotifs)
                    setUnreadCount(mappedNotifs.filter(n => !n.read).length)
                }
            } catch (err) {
                console.error('Error fetching alerts:', err)
            }
        }

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000) // Every minute
        return () => clearInterval(interval)
    }, [])

    const handleLogout = useCallback(async () => {
        if (logoutInProgressRef.current) return
        logoutInProgressRef.current = true

        try {
            const supabase = createClient()

            try {
                await unregisterCurrentDeviceToken()
            } catch {
                // non-critical
            }

            const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform()
            if (isCapacitor) {
                try {
                    const { GoogleAuth } = await import('@codetrix-studio/capacitor-google-auth')
                    await GoogleAuth.initialize({
                        clientId: '519109526767-1rfcfigbutf9217uuc69fosqjp6mis05.apps.googleusercontent.com',
                        scopes: ['profile', 'email'],
                        grantOfflineAccess: true
                    })
                    await GoogleAuth.signOut()
                } catch {
                    // Ignore if there is no Google session
                }
            }

            localStorage.removeItem('wazzapai_biometric_session')

            await supabase.auth.signOut()
            router.push('/login')
            router.refresh()
        } finally {
            logoutInProgressRef.current = false
        }
    }, [router])

    useSessionTimeout(isNativeApp ? null : sessionTimeoutHours, handleLogout)

    // Close notifications when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])



    const markAllAsRead = () => {
        setNotifications(prev => {
            const updated = prev.map(n => ({ ...n, read: true }))
            saveReadIds(new Set(updated.map(n => n.id)))
            return updated
        })
        setUnreadCount(0)
    }

    const getNotifIcon = (type: string) => {
        switch (type) {
            case 'success': return <Check style={{ width: 16, height: 16, color: '#4ade80' }} />
            case 'warning': return <AlertCircle style={{ width: 16, height: 16, color: '#fbbf24' }} />
            case 'error': return <AlertCircle style={{ width: 16, height: 16, color: '#f87171' }} />
            default: return <Bell style={{ width: 16, height: 16, color: '#60a5fa' }} />
        }
    }

    const getNotifBg = (type: string) => {
        switch (type) {
            case 'success': return 'rgba(34, 197, 94, 0.15)'
            case 'warning': return 'rgba(245, 158, 11, 0.15)'
            case 'error': return 'rgba(239, 68, 68, 0.15)'
            default: return 'rgba(59, 130, 246, 0.15)'
        }
    }

    const sidebarWidth = collapsed ? 80 : 220

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#020617',
            display: 'flex'
        }}>
            {/* Mobile header */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                    paddingBottom: '12px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Link href="/admin" style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            background: 'linear-gradient(135deg, #ef4444, #f97316)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Shield style={{ width: 20, height: 20, color: 'white' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'white' }}>Admin</span>
                    </Link>
                    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                padding: 8,
                                borderRadius: 12,
                                backgroundColor: showNotifications ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                        >
                            <Bell style={{ width: 20, height: 20, color: showNotifications ? '#34d399' : '#94a3b8' }} />
                            {unreadCount > 0 && (
                                <span style={{
                                    position: 'absolute',
                                    top: 4,
                                    right: 4,
                                    width: 8,
                                    height: 8,
                                    borderRadius: '50%',
                                    backgroundColor: '#ef4444'
                                }} />
                            )}
                        </button>
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            style={{
                                padding: 8,
                                borderRadius: 12,
                                backgroundColor: '#1e293b',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {mobileMenuOpen ?
                                <X style={{ width: 20, height: 20, color: 'white' }} /> :
                                <Menu style={{ width: 20, height: 20, color: 'white' }} />
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {/* Mobile Notification Panel */}
            {isMobile && showNotifications && (
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
                                <button onClick={markAllAsRead} style={{ background: 'none', border: 'none', color: '#34d399', fontSize: 13, cursor: 'pointer' }}>
                                    Tout marquer lu
                                </button>
                            )}
                            <button onClick={() => setShowNotifications(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
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
                        href="/admin/notifications"
                        onClick={() => setShowNotifications(false)}
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

            {mobileMenuOpen && isMobile && (
                    <>
                        <motion.div
                            key="mobile-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 40,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)',
                                touchAction: 'none'
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                            onTouchMove={e => e.preventDefault()}
                        />
                        <motion.div
                            key="mobile-sidebar"
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 280,
                                zIndex: 50,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(40px)',
                                borderRight: '1px solid rgba(148, 163, 184, 0.1)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                        >
                            <div style={{ padding: 24, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                                <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, textDecoration: 'none', flexShrink: 0 }}>
                                    <div style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 12,
                                        background: 'linear-gradient(135deg, #ef4444, #f97316)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <Shield style={{ width: 20, height: 20, color: 'white' }} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: 'white' }}>WazzapAI</div>
                                        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>SUPER ADMIN</div>
                                    </div>
                                </Link>
                                <nav style={{ display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: 2, overflowY: 'auto', flex: 1, minHeight: 0, WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
                                    {adminGroups.map((group, groupIdx) => (
                                        <div key={groupIdx}>
                                            {groupIdx > 0 && (
                                                <div style={{ height: 1, backgroundColor: 'rgba(148, 163, 184, 0.08)', margin: '8px 0' }} />
                                            )}
                                            {group.label && (
                                                <div style={{
                                                    fontSize: 10,
                                                    fontWeight: 700,
                                                    color: '#475569',
                                                    letterSpacing: '0.08em',
                                                    padding: '10px 8px 4px',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {group.label}
                                                </div>
                                            )}
                                            {group.items.map((link) => {
                                                const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
                                                return (
                                                    <Link
                                                        key={link.href}
                                                        href={link.href}
                                                        onClick={() => setMobileMenuOpen(false)}
                                                        style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 10,
                                                            padding: '10px 12px',
                                                            borderRadius: 10,
                                                            color: isActive ? '#34d399' : '#94a3b8',
                                                            fontWeight: 500,
                                                            fontSize: 13,
                                                            textDecoration: 'none',
                                                            backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                                            transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        <link.icon style={{ width: 18, height: 18 }} />
                                                        <span>{link.label}</span>
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    ))}
                                    <button
                                        onClick={handleLogout}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 12,
                                            padding: '14px 16px',
                                            borderRadius: 12,
                                            color: '#f87171',
                                            fontWeight: 500,
                                            backgroundColor: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            marginTop: 12,
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        <LogOut style={{ width: 20, height: 20 }} />
                                        <span>Déconnexion</span>
                                    </button>
                                </nav>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* Desktop Sidebar */}
            {!isMobile && (
                <aside style={{
                    width: sidebarWidth,
                    flexShrink: 0,
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    zIndex: 40,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(40px)',
                    borderRight: '1px solid rgba(148, 163, 184, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'width 0.3s ease'
                }}>
                    {/* Logo */}
                    <div style={{
                        padding: 16,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)'
                    }}>
                        <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #ef4444, #f97316)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <Shield style={{ width: 24, height: 24, color: 'white' }} />
                            </div>
                            {!collapsed && (
                                <div>
                                    <div style={{ fontWeight: 700, color: 'white' }}>WazzapAI</div>
                                    <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>SUPER ADMIN</div>
                                </div>
                            )}
                        </Link>
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            style={{
                                padding: 8,
                                borderRadius: 12,
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {collapsed ? <ChevronRight style={{ width: 20, height: 20 }} /> : <ChevronLeft style={{ width: 20, height: 20 }} />}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav style={{ flex: 1, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                        {adminGroups.map((group, groupIdx) => (
                            <div key={groupIdx}>
                                {groupIdx > 0 && (
                                    <div style={{ height: 1, backgroundColor: 'rgba(148, 163, 184, 0.08)', margin: collapsed ? '8px 4px' : '8px 4px' }} />
                                )}
                                {group.label && !collapsed && (
                                    <div style={{
                                        fontSize: 10,
                                        fontWeight: 700,
                                        color: '#475569',
                                        letterSpacing: '0.08em',
                                        padding: '10px 8px 4px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {group.label}
                                    </div>
                                )}
                                {group.items.map((link) => {
                                    const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            title={collapsed ? link.label : undefined}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 10,
                                                padding: collapsed ? '12px' : '10px 12px',
                                                borderRadius: 10,
                                                color: isActive ? '#34d399' : '#94a3b8',
                                                fontWeight: 500,
                                                fontSize: 13,
                                                textDecoration: 'none',
                                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                                                justifyContent: collapsed ? 'center' : 'flex-start',
                                                transition: 'all 0.15s ease'
                                            }}
                                        >
                                            <link.icon style={{ width: 18, height: 18, flexShrink: 0 }} />
                                            {!collapsed && <span>{link.label}</span>}
                                        </Link>
                                    )
                                })}
                            </div>
                        ))}
                    </nav>

                    {/* Footer - Logout Button */}
                    <div style={{ padding: 16, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                width: '100%',
                                padding: collapsed ? '14px' : '14px 16px',
                                borderRadius: 12,
                                color: '#f87171',
                                fontWeight: 500,
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <LogOut style={{ width: 20, height: 20, flexShrink: 0 }} />
                            {!collapsed && <span>Déconnexion</span>}
                        </button>
                    </div>
                </aside>
            )}

            {/* Main content */}
            <main style={{
                flex: 1,
                width: isMobile ? '100%' : `calc(100% - ${sidebarWidth}px)`,
                minWidth: 0,
                minHeight: '100vh',
                marginLeft: isMobile ? 0 : sidebarWidth,
                paddingTop: isMobile ? '64px' : 0,
                transition: 'margin-left 0.3s ease, width 0.3s ease'
            }}>
                {/* Top Bar - Desktop only */}
                {!isMobile && (
                    <header style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 30,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(20px)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        padding: '16px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ position: 'relative' }} ref={searchRef}>
                            <Search style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 20,
                                height: 20,
                                color: '#64748b',
                                zIndex: 1
                            }} />
                            <input
                                type="text"
                                placeholder="Rechercher une page..."
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value)
                                    setShowSearchResults(e.target.value.length > 0)
                                }}
                                onFocus={() => searchQuery.length > 0 && setShowSearchResults(true)}
                                onBlur={() => setTimeout(() => setShowSearchResults(false), 200)}
                                style={{
                                    width: 320,
                                    padding: '12px 12px 12px 44px',
                                    backgroundColor: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 14,
                                    color: 'white',
                                    fontSize: 14,
                                    outline: 'none'
                                }}
                            />
                            {showSearchResults && (
                                <div style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    right: 0,
                                    marginTop: 4,
                                    backgroundColor: '#1e293b',
                                    border: '1px solid rgba(148, 163, 184, 0.15)',
                                    borderRadius: 12,
                                    boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
                                    overflow: 'hidden',
                                    zIndex: 100
                                }}>
                                    {adminGroups.flatMap(g => g.items)
                                        .filter(link => link.label.toLowerCase().includes(searchQuery.toLowerCase()))
                                        .map((link, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    router.push(link.href)
                                                    setSearchQuery('')
                                                    setShowSearchResults(false)
                                                }}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    width: '100%',
                                                    padding: '10px 14px',
                                                    background: 'none',
                                                    border: 'none',
                                                    borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                                    color: 'white',
                                                    fontSize: 13,
                                                    cursor: 'pointer',
                                                    textAlign: 'left'
                                                }}
                                                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(16, 185, 129, 0.1)')}
                                                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                            >
                                                <link.icon style={{ width: 16, height: 16, color: '#34d399' }} />
                                                {link.label}
                                            </button>
                                        ))}
                                    {adminGroups.flatMap(g => g.items).filter(link => link.label.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                                        <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                                            Aucun résultat
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            {/* Notifications Bell */}
                            <div ref={notifRef} style={{ position: 'relative' }}>
                                <button
                                    onClick={() => setShowNotifications(!showNotifications)}
                                    style={{
                                        padding: 10,
                                        borderRadius: 12,
                                        backgroundColor: showNotifications ? 'rgba(16, 185, 129, 0.15)' : '#1e293b',
                                        border: 'none',
                                        cursor: 'pointer',
                                        position: 'relative'
                                    }}
                                >
                                    <Bell style={{ width: 20, height: 20, color: showNotifications ? '#34d399' : '#94a3b8' }} />
                                    {unreadCount > 0 && (
                                        <span style={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            minWidth: 18,
                                            height: 18,
                                            borderRadius: 9,
                                            backgroundColor: '#ef4444',
                                            color: 'white',
                                            fontSize: 11,
                                            fontWeight: 700,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            padding: '0 4px'
                                        }}>
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    )}
                                </button>

                                {/* Notifications Dropdown */}
                                <AnimatePresence>
                                    {showNotifications && (
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
                                                        onClick={markAllAsRead}
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
                                                href="/admin/notifications"
                                                onClick={() => setShowNotifications(false)}
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
                            </div>

                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                paddingLeft: 16,
                                borderLeft: '1px solid rgba(148, 163, 184, 0.2)'
                            }}>
                                <div style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #ef4444, #f97316)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    color: 'white',
                                    fontWeight: 700,
                                    fontSize: 14
                                }}>
                                    SA
                                </div>
                                <div>
                                    <div style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>Super Admin</div>
                                    <div style={{ fontSize: 12, color: '#94a3b8' }}>{adminEmail}</div>
                                </div>
                            </div>
                        </div>
                    </header>
                )}

                <div style={{ padding: isMobile ? '12px' : '24px 32px 24px 24px' }}>
                    {children}
                </div>
            </main>
        </div>
    )
}


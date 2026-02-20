'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MessageCircle,
    LayoutDashboard,
    Bot,
    MessagesSquare,
    BarChart3,
    CreditCard,
    Settings,
    HelpCircle,
    LogOut,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Zap,
    Package,
    ShoppingBag,
    Bell,
    Check,
    AlertCircle,
    ShoppingCart,
    Users,
    Coins,
    TrendingUp
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations } from 'next-intl'
import { GlobalSearch } from '@/components/dashboard/GlobalSearch'

interface Notification {
    id: string
    type: 'info' | 'success' | 'warning' | 'order' | 'credits'
    title: string
    message: string
    time: string
    read: boolean
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const t = useTranslations('Dashboard.sidebar')
    const pathname = usePathname()
    const router = useRouter()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const notifRef = useRef<HTMLDivElement>(null)

    // Defined inside component to use hooks
    const sidebarLinks = [
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { href: '/dashboard/agents', label: t('agents'), icon: Bot },
        { href: '/dashboard/conversations', label: t('conversations'), icon: MessagesSquare },
        { href: '/dashboard/products', label: t('products'), icon: Package },
        { href: '/dashboard/orders', label: t('orders'), icon: ShoppingBag },
        { href: '/dashboard/analytics', label: t('analytics'), icon: TrendingUp },
        { href: '/dashboard/playground', label: t('playground'), icon: Zap },
        { href: '/dashboard/billing', label: t('billing'), icon: CreditCard },
        { href: '/dashboard/settings', label: t('settings'), icon: Settings },
        { href: '/dashboard/help', label: t('help'), icon: HelpCircle },
    ]

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Format time ago
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

    // Fetch user notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const now = new Date()
                const notifs: Notification[] = []

                // Get user's agents
                const { data: userAgents } = await supabase
                    .from('agents')
                    .select('id')
                    .eq('user_id', user.id)

                const agentIds = userAgents?.map(a => a.id) || []

                // Get recent orders (last 24h)
                if (agentIds.length > 0) {
                    const { data: recentOrders } = await supabase
                        .from('orders')
                        .select('id, order_number, total_amount, created_at')
                        .in('agent_id', agentIds)
                        .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
                        .order('created_at', { ascending: false })
                        .limit(5)

                    recentOrders?.forEach(order => {
                        notifs.push({
                            id: `order-${order.id}`,
                            type: 'order',
                            title: 'Nouvelle commande',
                            message: `#${order.order_number} - ${order.total_amount?.toLocaleString()} FCFA`,
                            time: formatTimeAgo(new Date(order.created_at)),
                            read: false
                        })
                    })

                    // Get recent conversations (last 12h)
                    const { data: recentConvos } = await supabase
                        .from('conversations')
                        .select('id, contact_name, created_at')
                        .in('agent_id', agentIds)
                        .gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
                        .order('created_at', { ascending: false })
                        .limit(3)

                    recentConvos?.forEach(convo => {
                        notifs.push({
                            id: `convo-${convo.id}`,
                            type: 'info',
                            title: 'Nouvelle conversation',
                            message: convo.contact_name || 'Contact WhatsApp',
                            time: formatTimeAgo(new Date(convo.created_at)),
                            read: false
                        })
                    })
                }

                // Check credits
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('credits')
                    .eq('id', user.id)
                    .single()

                if (profile && profile.credits < 50) {
                    notifs.push({
                        id: 'low-credits',
                        type: 'credits',
                        title: 'Crédits faibles',
                        message: `Il vous reste ${profile.credits} crédits`,
                        time: 'Maintenant',
                        read: false
                    })
                }

                setNotifications(notifs.slice(0, 10))
                setUnreadCount(notifs.filter(n => !n.read).length)

            } catch (err) {
                console.error('Error fetching notifications:', err)
            }
        }

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000) // Refresh every minute
        return () => clearInterval(interval)
    }, [])

    // Claim unclaimed device tokens on login (for Android WebView)
    useEffect(() => {
        const claimTokens = async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                await fetch('/api/notifications/claim-token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id })
                })
            } catch (err) {
                // Silent fail — non-critical
            }
        }
        claimTokens()
    }, [])

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
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
        setUnreadCount(0)
    }

    const getNotifIcon = (type: string) => {
        switch (type) {
            case 'order': return <ShoppingCart style={{ width: 16, height: 16, color: '#4ade80' }} />
            case 'credits': return <Coins style={{ width: 16, height: 16, color: '#fbbf24' }} />
            case 'success': return <Check style={{ width: 16, height: 16, color: '#4ade80' }} />
            case 'warning': return <AlertCircle style={{ width: 16, height: 16, color: '#fbbf24' }} />
            default: return <MessageCircle style={{ width: 16, height: 16, color: '#60a5fa' }} />
        }
    }

    const getNotifBg = (type: string) => {
        switch (type) {
            case 'order': return 'rgba(34, 197, 94, 0.15)'
            case 'credits': return 'rgba(245, 158, 11, 0.15)'
            case 'success': return 'rgba(34, 197, 94, 0.15)'
            case 'warning': return 'rgba(245, 158, 11, 0.15)'
            default: return 'rgba(59, 130, 246, 0.15)'
        }
    }

    const handleLogout = async () => {
        const supabase = createClient()
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const sidebarWidth = collapsed ? 80 : 260

    return (
        <div style={{
            minHeight: '100vh',
            height: '100%',
            backgroundColor: '#0f172a',
            display: 'flex',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Mobile header */}
            {isMobile && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(20px)',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
                        <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                        </div>
                        <span style={{ fontWeight: 700, color: 'white', fontSize: 18 }}>WazzapAI</span>
                    </Link>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            style={{
                                padding: 8,
                                borderRadius: 10,
                                backgroundColor: 'rgba(51, 65, 85, 0.5)',
                                border: 'none',
                                cursor: 'pointer',
                                position: 'relative'
                            }}
                        >
                            <Bell style={{ width: 20, height: 20, color: '#94a3b8' }} />
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
                                borderRadius: 10,
                                backgroundColor: 'rgba(51, 65, 85, 0.5)',
                                border: 'none',
                                cursor: 'pointer'
                            }}
                        >
                            {mobileMenuOpen ?
                                <X style={{ width: 22, height: 22, color: 'white' }} /> :
                                <Menu style={{ width: 22, height: 22, color: 'white' }} />
                            }
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Notifications Dropdown */}
            <AnimatePresence>
                {showNotifications && isMobile && (
                    <motion.div
                        ref={notifRef}
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
                                    onClick={markAllAsRead}
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
                                    <div
                                        key={notif.id}
                                        style={{
                                            padding: '12px 16px',
                                            borderBottom: '1px solid rgba(148, 163, 184, 0.05)',
                                            display: 'flex',
                                            gap: 10,
                                            backgroundColor: notif.read ? 'transparent' : 'rgba(16, 185, 129, 0.05)'
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
                                    </div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Mobile sidebar overlay */}
            <AnimatePresence>
                {mobileMenuOpen && isMobile && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                zIndex: 40,
                                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                left: 0,
                                top: 0,
                                bottom: 0,
                                width: 'min(280px, 85vw)',
                                zIndex: 50,
                                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                                backdropFilter: 'blur(40px)',
                                borderRight: '1px solid rgba(148, 163, 184, 0.1)',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            <div style={{ padding: 20, borderBottom: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                                    <div style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 12,
                                        background: 'linear-gradient(135deg, #10b981, #059669)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}>
                                        <MessageCircle style={{ width: 22, height: 22, color: 'white' }} />
                                    </div>
                                    <span style={{ fontWeight: 700, color: 'white', fontSize: 20 }}>WazzapAI</span>
                                </Link>
                            </div>
                            <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
                                {sidebarLinks.map((link) => {
                                    const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 12,
                                                padding: '12px 14px',
                                                borderRadius: 12,
                                                color: isActive ? '#34d399' : '#94a3b8',
                                                fontWeight: 500,
                                                textDecoration: 'none',
                                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent'
                                            }}
                                        >
                                            <link.icon style={{ width: 20, height: 20 }} />
                                            <span>{link.label}</span>
                                        </Link>
                                    )
                                })}
                                {/* Logout button right after menu items */}
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        color: '#f87171',
                                        fontWeight: 500,
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer',
                                        marginTop: 8
                                    }}
                                >
                                    <LogOut style={{ width: 20, height: 20 }} />
                                    <span>{t('logout')}</span>
                                </button>
                            </nav>
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
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                            <div style={{
                                width: 44,
                                height: 44,
                                borderRadius: 12,
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0
                            }}>
                                <MessageCircle style={{ width: 22, height: 22, color: 'white' }} />
                            </div>
                            {!collapsed && (
                                <span style={{ fontWeight: 700, color: 'white', fontSize: 20 }}>WazzapAI</span>
                            )}
                        </Link>
                        <button
                            onClick={() => setCollapsed(!collapsed)}
                            style={{
                                padding: 8,
                                borderRadius: 10,
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#94a3b8',
                                cursor: 'pointer'
                            }}
                        >
                            {collapsed ? <ChevronRight style={{ width: 20, height: 20 }} /> : <ChevronLeft style={{ width: 20, height: 20 }} />}
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav style={{ flex: 1, padding: 12, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
                        {sidebarLinks.map((link) => {
                            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    title={collapsed ? link.label : undefined}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: collapsed ? '12px' : '12px 14px',
                                        borderRadius: 12,
                                        color: isActive ? '#34d399' : '#94a3b8',
                                        fontWeight: 500,
                                        textDecoration: 'none',
                                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        justifyContent: collapsed ? 'center' : 'flex-start',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    <link.icon style={{ width: 20, height: 20, flexShrink: 0 }} />
                                    {!collapsed && <span>{link.label}</span>}
                                </Link>
                            )
                        })}
                    </nav>

                    {/* Footer */}
                    <div style={{ padding: 12, borderTop: '1px solid rgba(148, 163, 184, 0.1)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <Link
                            href="/dashboard/help"
                            title={collapsed ? t('help') : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: collapsed ? '12px' : '12px 14px',
                                borderRadius: 12,
                                color: '#94a3b8',
                                fontWeight: 500,
                                textDecoration: 'none',
                                justifyContent: collapsed ? 'center' : 'flex-start'
                            }}
                        >
                            <HelpCircle style={{ width: 20, height: 20, flexShrink: 0 }} />
                            {!collapsed && <span>{t('help')}</span>}
                        </Link>
                        <button
                            onClick={handleLogout}
                            title={collapsed ? t('logout') : undefined}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: collapsed ? '12px' : '12px 14px',
                                borderRadius: 12,
                                color: '#f87171',
                                fontWeight: 500,
                                backgroundColor: 'transparent',
                                border: 'none',
                                cursor: 'pointer',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                width: '100%'
                            }}
                        >
                            <LogOut style={{ width: 20, height: 20, flexShrink: 0 }} />
                            {!collapsed && <span>{t('logout')}</span>}
                        </button>
                    </div>
                </aside>
            )}

            {/* Main content */}
            <main style={{
                flex: 1,
                minHeight: '100vh',
                height: '100vh',
                marginLeft: isMobile ? 0 : sidebarWidth,
                paddingTop: isMobile ? 64 : 0,
                transition: 'margin-left 0.3s ease',
                backgroundColor: '#0f172a',
                overflowX: 'hidden',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch'
            }}>
                {/* Desktop Top Bar with Notifications */}
                {!isMobile && (
                    <div style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 30,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        backdropFilter: 'blur(20px)',
                        borderBottom: '1px solid rgba(148, 163, 184, 0.1)',
                        padding: '12px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16
                    }}>
                        {/* Global Search */}
                        <GlobalSearch />

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
                                            width: 360,
                                            maxHeight: 450,
                                            backgroundColor: '#1e293b',
                                            border: '1px solid rgba(148, 163, 184, 0.1)',
                                            borderRadius: 16,
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                                            overflow: 'hidden'
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
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                )}

                <div style={{
                    padding: isMobile ? '16px' : '24px',
                    maxWidth: '1400px',
                    margin: '0 auto',
                    width: '100%',
                    boxSizing: 'border-box',
                    paddingBottom: isMobile ? '100px' : '40px'
                }}>
                    {children}
                </div>
            </main>
        </div>
    )
}

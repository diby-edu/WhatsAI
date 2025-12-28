'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    LayoutDashboard,
    Users,
    Bot,
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
    Package
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const adminLinks = [
    { href: '/admin', label: 'Vue d\'ensemble', icon: Gauge },
    { href: '/admin/users', label: 'Utilisateurs', icon: Users },
    { href: '/admin/agents', label: 'Agents IA', icon: Bot },
    { href: '/admin/conversations', label: 'Conversations', icon: MessagesSquare },
    { href: '/admin/plans', label: 'Plans', icon: Zap },
    { href: '/admin/credit-packs', label: 'Packs de Crédits', icon: Package },
    { href: '/admin/subscriptions', label: 'Abonnements', icon: CreditCard },
    { href: '/admin/payments', label: 'Test Paiement', icon: TestTube2 },
    { href: '/admin/diagnostics', label: 'Diagnostic', icon: Activity },
    { href: '/admin/analytics', label: 'Analytics', icon: BarChart3 },
    { href: '/admin/logs', label: 'Logs', icon: FileText },
    { href: '/admin/settings', label: 'Paramètres', icon: Settings },
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
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [adminEmail, setAdminEmail] = useState('admin@whatsai.com')
    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState<Notification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const notifRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

    // Fetch admin email
    useEffect(() => {
        const fetchAdminEmail = async () => {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user?.email) {
                setAdminEmail(user.email)
            }
        }
        fetchAdminEmail()
    }, [])

    // Fetch real notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const supabase = createClient()

                // Get recent activities as notifications
                const now = new Date()
                const notifs: Notification[] = []

                // Check for new users (last 24h)
                const { data: newUsers } = await supabase
                    .from('profiles')
                    .select('id, email, created_at')
                    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
                    .order('created_at', { ascending: false })
                    .limit(5)

                newUsers?.forEach(user => {
                    notifs.push({
                        id: `user-${user.id}`,
                        type: 'info',
                        title: 'Nouvel utilisateur',
                        message: user.email || 'Utilisateur inscrit',
                        time: formatTimeAgo(new Date(user.created_at)),
                        read: false
                    })
                })

                // Check for new agents
                const { data: newAgents } = await supabase
                    .from('agents')
                    .select('id, name, created_at')
                    .gte('created_at', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString())
                    .order('created_at', { ascending: false })
                    .limit(3)

                newAgents?.forEach(agent => {
                    notifs.push({
                        id: `agent-${agent.id}`,
                        type: 'success',
                        title: 'Nouvel agent créé',
                        message: agent.name,
                        time: formatTimeAgo(new Date(agent.created_at)),
                        read: false
                    })
                })

                // Check for new conversations
                const { data: newConvos } = await supabase
                    .from('conversations')
                    .select('id, contact_name, created_at')
                    .gte('created_at', new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())
                    .order('created_at', { ascending: false })
                    .limit(3)

                newConvos?.forEach(convo => {
                    notifs.push({
                        id: `convo-${convo.id}`,
                        type: 'info',
                        title: 'Nouvelle conversation',
                        message: convo.contact_name || 'Contact WhatsApp',
                        time: formatTimeAgo(new Date(convo.created_at)),
                        read: false
                    })
                })

                // Sort by time and limit
                notifs.sort((a, b) => a.time.localeCompare(b.time))
                setNotifications(notifs.slice(0, 10))
                setUnreadCount(notifs.filter(n => !n.read).length)

            } catch (err) {
                console.error('Error fetching notifications:', err)
            }
        }

        fetchNotifications()
        // Refresh every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
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

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })))
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

    const sidebarWidth = collapsed ? 80 : 280

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
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button style={{
                            padding: 8,
                            borderRadius: 12,
                            backgroundColor: '#1e293b',
                            border: 'none',
                            cursor: 'pointer',
                            position: 'relative'
                        }}>
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
                                width: 280,
                                zIndex: 50,
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(40px)',
                                borderRight: '1px solid rgba(148, 163, 184, 0.1)'
                            }}
                        >
                            <div style={{ padding: 24 }}>
                                <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32, textDecoration: 'none' }}>
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
                                        <div style={{ fontWeight: 700, color: 'white' }}>WhatsAI</div>
                                        <div style={{ fontSize: 12, color: '#ef4444', fontWeight: 500 }}>SUPER ADMIN</div>
                                    </div>
                                </Link>
                                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {adminLinks.map((link) => {
                                        const isActive = pathname === link.href
                                        return (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 12,
                                                    padding: '14px 16px',
                                                    borderRadius: 12,
                                                    color: isActive ? '#34d399' : '#94a3b8',
                                                    fontWeight: 500,
                                                    textDecoration: 'none',
                                                    backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                <link.icon style={{ width: 20, height: 20 }} />
                                                <span>{link.label}</span>
                                            </Link>
                                        )
                                    })}
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
                                    <div style={{ fontWeight: 700, color: 'white' }}>WhatsAI</div>
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
                    <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
                        {adminLinks.map((link) => {
                            const isActive = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href))
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    title={collapsed ? link.label : undefined}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: collapsed ? '14px' : '14px 16px',
                                        borderRadius: 12,
                                        color: isActive ? '#34d399' : '#94a3b8',
                                        fontWeight: 500,
                                        textDecoration: 'none',
                                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
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
                    <div style={{ padding: 16, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                        <Link
                            href="/"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                                padding: collapsed ? '14px' : '14px 16px',
                                borderRadius: 12,
                                color: '#f87171',
                                fontWeight: 500,
                                textDecoration: 'none',
                                justifyContent: collapsed ? 'center' : 'flex-start',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <LogOut style={{ width: 20, height: 20, flexShrink: 0 }} />
                            {!collapsed && <span>Retour au site</span>}
                        </Link>
                    </div>
                </aside>
            )}

            {/* Main content */}
            <main style={{
                flex: 1,
                minHeight: '100vh',
                marginLeft: isMobile ? 0 : sidebarWidth,
                paddingTop: isMobile ? 64 : 0,
                transition: 'margin-left 0.3s ease'
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
                        <div style={{ position: 'relative' }}>
                            <Search style={{
                                position: 'absolute',
                                left: 12,
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: 20,
                                height: 20,
                                color: '#64748b'
                            }} />
                            <input
                                type="text"
                                placeholder="Rechercher..."
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

                <div style={{ padding: 24 }}>
                    {children}
                </div>
            </main>
        </div>
    )
}

'use client'

import { useState, useEffect } from 'react'
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
    ShoppingBag
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const sidebarLinks = [
    { href: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard },
    { href: '/dashboard/agents', label: 'Agents', icon: Bot },
    { href: '/dashboard/conversations', label: 'Conversations', icon: MessagesSquare },
    { href: '/dashboard/products', label: 'Produits', icon: Package },
    { href: '/dashboard/orders', label: 'Commandes', icon: ShoppingBag },
    { href: '/dashboard/playground', label: 'Playground', icon: Zap },
    { href: '/dashboard/billing', label: 'Facturation', icon: CreditCard },
    { href: '/dashboard/settings', label: 'Paramètres', icon: Settings },
    { href: '/dashboard/help', label: 'Aide', icon: HelpCircle },
]

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const pathname = usePathname()
    const router = useRouter()
    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

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
            backgroundColor: '#0f172a',
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
                        <span style={{ fontWeight: 700, color: 'white', fontSize: 18 }}>WhatsAI</span>
                    </Link>
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
                                    <span style={{ fontWeight: 700, color: 'white', fontSize: 20 }}>WhatsAI</span>
                                </Link>
                            </div>
                            <nav style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
                            </nav>
                            <div style={{ padding: 16, borderTop: '1px solid rgba(148, 163, 184, 0.1)' }}>
                                <button
                                    onClick={handleLogout}
                                    style={{
                                        width: '100%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 12,
                                        padding: '12px 14px',
                                        borderRadius: 12,
                                        color: '#f87171',
                                        fontWeight: 500,
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <LogOut style={{ width: 20, height: 20 }} />
                                    <span>Déconnexion</span>
                                </button>
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
                                <span style={{ fontWeight: 700, color: 'white', fontSize: 20 }}>WhatsAI</span>
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
                            href="/help"
                            title={collapsed ? 'Aide' : undefined}
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
                            {!collapsed && <span>Aide</span>}
                        </Link>
                        <button
                            onClick={handleLogout}
                            title={collapsed ? 'Déconnexion' : undefined}
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
                            {!collapsed && <span>Déconnexion</span>}
                        </button>
                    </div>
                </aside>
            )}

            {/* Main content */}
            <main style={{
                flex: 1,
                minHeight: '100vh',
                marginLeft: isMobile ? 0 : sidebarWidth,
                paddingTop: isMobile ? 64 : 0,
                transition: 'margin-left 0.3s ease',
                backgroundColor: '#0f172a'
            }}>
                <div style={{ padding: 24 }}>
                    {children}
                </div>
            </main>
        </div>
    )
}

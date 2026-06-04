'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
    MessageCircle,
    LayoutDashboard,
    Bot,
    MessagesSquare,
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
    Coins,
    TrendingUp,
    Code2,
    BookOpen,
    Gift,
    Target
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { initWebPush } from '@/lib/notifications/web-push'
import {
    type DashboardNotification,
    fetchDashboardNotifications,
    markAllDashboardNotificationsAsRead,
    markDashboardNotificationAsRead,
} from '@/lib/notifications/user-notifications'
import { useTranslations, useLocale } from 'next-intl'
import { GlobalSearch } from '@/components/dashboard/GlobalSearch'
import { useAndroidBackButton } from '@/hooks/useAndroidBackButton'
import { BiometricLock } from '@/components/BiometricLock'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { useSessionTimeout } from '@/hooks/useSessionTimeout'
import { useNativeDeviceTokenSync } from '@/hooks/useNativeDeviceTokenSync'
import { unregisterCurrentDeviceToken } from '@/lib/notifications/device-token-client'
import { TestAccountCountdownBanner } from '@/components/dashboard/TestAccountCountdownBanner'
import AppDownloadBanner from '@/components/dashboard/AppDownloadBanner'
import PhoneVerifyModal from '@/components/dashboard/PhoneVerifyModal'
import MobileAppPrompt from '@/components/dashboard/MobileAppPrompt'
import { ToastProvider } from '@/components/ui/Toast'
import { UpgradeModalProvider, useUpgradeModal } from '@/contexts/UpgradeModalContext'
import UpgradeModal from '@/components/dashboard/UpgradeModal'

type TestAccountBannerState = {
    bannerMode: 'test' | 'frozen_grace' | 'inactive' | null
    isTestAccount: boolean
    showCountdown: boolean
    isExpired: boolean
    isExpiredSubscriber: boolean
    cleanupDeadline: string | null
    remainingMs: number | null
    graceDays: number
    lifecycleStatus?: 'test' | 'paid_active' | 'frozen_grace' | 'inactive'
    hasUnusedCredits?: boolean
    isTestGraceMode?: boolean
}

function UpgradeSessionWatcher({ plan }: { plan: string }) {
    const { openUpgradeModal } = useUpgradeModal()
    useEffect(() => {
        if (plan !== 'free') return
        if (typeof sessionStorage === 'undefined') return
        if (sessionStorage.getItem('upgrade_session_shown') === '1') return
        const t = setTimeout(() => {
            sessionStorage.setItem('upgrade_session_shown', '1')
            openUpgradeModal('session')
        }, 30000)
        return () => clearTimeout(t)
    }, [plan, openUpgradeModal])
    return null
}

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const t = useTranslations('Dashboard.sidebar')
    const locale = useLocale()
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const isNativeApp = useNativeDeviceTokenSync()

    // Handle Android hardware back button
    useAndroidBackButton()

    const [collapsed, setCollapsed] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [isMobile, setIsMobile] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [notifications, setNotifications] = useState<DashboardNotification[]>([])
    const [unreadCount, setUnreadCount] = useState(0)
    const [userAvatar, setUserAvatar] = useState<string | null>(null)
    const [userName, setUserName] = useState<string>('')
    const [apiAccessEnabled, setApiAccessEnabled] = useState<boolean | null>(null)
    const [profileLoaded, setProfileLoaded] = useState(false)
    const [sessionTimeoutHours, setSessionTimeoutHours] = useState<number | null>(null)
    const [testAccountBanner, setTestAccountBanner] = useState<TestAccountBannerState | null>(null)
    const [appBannerDismissed, setAppBannerDismissed] = useState(false)
    const [phoneVerified, setPhoneVerified] = useState(true) // true par défaut pour éviter le flash
    const [profilePhone, setProfilePhone] = useState<string | null>(null)
    const [phoneModalDismissedSession, setPhoneModalDismissedSession] = useState(false)
    const [userPlan, setUserPlan] = useState<string>('free')
    const [userCredits, setUserCredits] = useState<number>(0)
    const notifRef = useRef<HTMLDivElement>(null)
    const mobileNotifBtnRef = useRef<HTMLDivElement>(null)
    const mobileNotifDropdownRef = useRef<HTMLDivElement>(null)
    const logoutInProgressRef = useRef(false)

    // Defined inside component to use hooks
    type NavLink = { href: string; label: string; icon: React.ComponentType<{ style?: React.CSSProperties }> ; featured?: boolean }
    type NavSeparator = { separator: true; label: string }
    type NavItem = NavLink | NavSeparator

    const sidebarLinks: NavItem[] = [
        // ── EN VEDETTE ──────────────────────────────────────────────
        { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard, featured: true },
        { href: '/dashboard/agents', label: t('agents'), icon: Bot, featured: true },
        { href: '/dashboard/knowledge', label: 'Base de connaissances', icon: BookOpen, featured: true },
        { href: '/dashboard/products', label: t('products'), icon: Package, featured: true },
        // ── QUOTIDIEN ───────────────────────────────────────────────
        { separator: true, label: 'Quotidien' },
        { href: '/dashboard/conversations', label: t('conversations'), icon: MessagesSquare },
        { href: '/dashboard/leads', label: 'Leads', icon: Target },
        { href: '/dashboard/orders', label: t('orders'), icon: ShoppingBag },
        { href: '/dashboard/analytics', label: t('analytics'), icon: TrendingUp },
        // ── COMPTE ──────────────────────────────────────────────────
        { separator: true, label: 'Compte' },
        { href: '/dashboard/billing', label: t('billing'), icon: CreditCard },
        { href: '/dashboard/developers', label: 'API', icon: Code2 },
        { href: '/dashboard/settings', label: t('settings'), icon: Settings },
    ]

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)
        checkMobile()
        window.addEventListener('resize', checkMobile)
        return () => window.removeEventListener('resize', checkMobile)
    }, [])

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

    useEffect(() => {
        const checkApiAccess = async () => {
            try {
                const res = await fetch('/api/profile', { cache: 'no-store' })
                if (!res.ok) return
                const json = await res.json()
                const profile = json.data?.profile || json.profile || json.data || json
                setApiAccessEnabled(profile?.api_access_enabled ?? null)
                setAppBannerDismissed(profile?.app_banner_dismissed ?? false)
                setPhoneVerified(profile?.phone_verified ?? false)
                setProfilePhone(profile?.phone ?? null)
                setUserPlan((profile?.plan || 'free').toLowerCase())
                setUserCredits(profile?.credits ?? 0)
            } catch (_) {} finally {
                setProfileLoaded(true)
            }
        }
        checkApiAccess()
    }, [])

    useEffect(() => {
        if (sessionStorage.getItem('phone_verify_dismissed') === '1') {
            setPhoneModalDismissedSession(true)
        }
    }, [])

    useEffect(() => {
        let alive = true

        const fetchTestAccountBanner = async () => {
            try {
                const res = await fetch('/api/dashboard/test-account-status', { cache: 'no-store' })
                const payload = await res.json()
                if (!alive) return

                if (payload?.success && payload?.data) {
                    setTestAccountBanner(payload.data)
                }
            } catch (err) {
                if (alive) {
                    console.error('Error fetching test account banner:', err)
                }
            }
        }

        void fetchTestAccountBanner()
        const interval = window.setInterval(fetchTestAccountBanner, 30000)
        const handleFocus = () => { void fetchTestAccountBanner() }
        window.addEventListener('focus', handleFocus)

        return () => {
            alive = false
            window.clearInterval(interval)
            window.removeEventListener('focus', handleFocus)
        }
    }, [])
    // Fetch user notifications
    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const result = await fetchDashboardNotifications(10)
                setNotifications(result.notifications)
                setUnreadCount(result.notifications.filter((notification) => !notification.read).length)

                if (result.profile.avatarUrl) setUserAvatar(result.profile.avatarUrl)
                if (result.profile.fullName) setUserName(result.profile.fullName)
            } catch (err) {
                console.error('Error fetching notifications:', err)
            }
        }

        fetchNotifications()
        const interval = setInterval(fetchNotifications, 60000)
        return () => clearInterval(interval)
    }, [])


    // Web push notifications for PC browsers
    useEffect(() => {
        if (isNativeApp) return

        const registerWebPush = async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return

                const token = await initWebPush()
                if (!token) return

                await fetch('/api/notifications/register-device', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token, platform: 'web' })
                })
            } catch {
                // Silent fail â€” non-critical
            }
        }

        const t = setTimeout(registerWebPush, 2000)
        return () => clearTimeout(t)
    }, [isNativeApp])

    // Close notifications when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node

            if (isMobile) {
                // On mobile, check both the button and the dropdown
                const isInsideBtn = mobileNotifBtnRef.current?.contains(target)
                const isInsideDropdown = mobileNotifDropdownRef.current?.contains(target)
                if (!isInsideBtn && !isInsideDropdown) {
                    setShowNotifications(false)
                }
            } else {
                // On desktop, check the desktop container
                if (notifRef.current && !notifRef.current.contains(target)) {
                    setShowNotifications(false)
                }
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isMobile])

    const markAllAsRead = async () => {
        setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
        setUnreadCount(0)
        await markAllDashboardNotificationsAsRead(notifications)
    }

    const handleNotificationClick = async (notification: DashboardNotification) => {
        setShowNotifications(false)
        setNotifications((prev) =>
            prev.map((item) => item.id === notification.id ? { ...item, read: true } : item)
        )
        setUnreadCount((prev) => Math.max(0, prev - (notification.read ? 0 : 1)))

        await markDashboardNotificationAsRead(notification)
        router.push(notification.href)
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

            const capacitorWindow = window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }
            const isCapacitor = typeof window !== 'undefined' && capacitorWindow.Capacitor?.isNativePlatform?.()
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
                    paddingTop: 'calc(12px + env(safe-area-inset-top, 0px))',
                    paddingBottom: '12px',
                    paddingLeft: '16px',
                    paddingRight: '16px',
                    display: 'flex',
                    flexWrap: 'nowrap',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Link href="/" style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
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
                    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 6 }}>
                        {/* Parrainage */}
                        <Link href="/dashboard/settings?tab=referral" title="Parrainage" style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(51, 65, 85, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Gift style={{ width: 20, height: 20, color: '#a855f7' }} />
                            </div>
                        </Link>

                        {/* Notifications */}
                        <div ref={mobileNotifBtnRef} style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                style={{
                                    padding: 8,
                                    borderRadius: 10,
                                    backgroundColor: showNotifications ? 'rgba(16, 185, 129, 0.15)' : 'rgba(51, 65, 85, 0.5)',
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
                        </div>

                        {/* Aide */}
                        <Link href="/dashboard/help" title="Aide" style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(51, 65, 85, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <HelpCircle style={{ width: 20, height: 20, color: '#94a3b8' }} />
                            </div>
                        </Link>

                        {/* Déconnexion */}
                        <button
                            onClick={handleLogout}
                            title={t('logout')}
                            style={{ padding: 8, borderRadius: 10, backgroundColor: 'rgba(51, 65, 85, 0.5)', border: 'none', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                            <LogOut style={{ width: 20, height: 20, color: '#f87171' }} />
                        </button>

                        {/* Avatar */}
                        <Link href="/dashboard/settings" style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{
                                width: 34, height: 34, borderRadius: '50%',
                                overflow: 'hidden',
                                background: userAvatar ? 'transparent' : 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 14, fontWeight: 600,
                                border: '2px solid rgba(16, 185, 129, 0.3)',
                                cursor: 'pointer'
                            }}>
                                {userAvatar
                                    ? <img src={userAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    : (userName?.charAt(0)?.toUpperCase() || '?')
                                }
                            </div>
                        </Link>

                        {/* Hamburger */}
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
                        ref={mobileNotifDropdownRef}
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
                                    <button
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
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
                            href="/dashboard/notifications"
                            onClick={() => setShowNotifications(false)}
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
                                backdropFilter: 'blur(4px)',
                                touchAction: 'none'
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                            onTouchMove={e => e.preventDefault()}
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
                                flexDirection: 'column',
                                overflow: 'hidden'
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
                            <nav style={{ flex: 1, minHeight: 0, padding: 16, display: 'flex', flexDirection: 'column', flexWrap: 'nowrap', gap: 4, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
                                {sidebarLinks.map((item, idx) => {
                                    if ('separator' in item) {
                                        return (
                                            <div key={`sep-${idx}`} style={{ margin: '8px 0 4px', padding: '0 4px' }}>
                                                <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 6 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</span>
                                                </div>
                                            </div>
                                        )
                                    }
                                    const link = item as NavLink
                                    const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                                    const planHasApi = ['pro', 'business', 'scale'].includes(userPlan)
                                    const isApiLocked = profileLoaded && link.href === '/dashboard/developers' && (apiAccessEnabled === false || (!planHasApi && apiAccessEnabled !== true))
                                    const isApiLockedByPlan = isApiLocked && apiAccessEnabled !== false
                                    if (isApiLocked) {
                                        return (
                                            <div
                                                key={link.href}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 12,
                                                    padding: '12px 14px', borderRadius: 12,
                                                    color: '#4b5563', fontWeight: 500,
                                                    cursor: 'not-allowed', userSelect: 'none',
                                                    justifyContent: 'space-between'
                                                }}
                                            >
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <link.icon style={{ width: 20, height: 20 }} />
                                                    <span>{link.label}</span>
                                                </div>
                                                <span style={{
                                                    fontSize: 9, fontWeight: 700, padding: '2px 5px',
                                                    borderRadius: 4,
                                                    background: isApiLockedByPlan ? 'rgba(234,179,8,0.15)' : 'rgba(100,116,139,0.15)',
                                                    color: isApiLockedByPlan ? '#ca8a04' : '#64748b',
                                                    textTransform: 'uppercase', letterSpacing: '0.05em',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {isApiLockedByPlan ? 'Pro' : 'Off'}
                                                </span>
                                            </div>
                                        )
                                    }
                                    return (
                                        <Link
                                            key={link.href}
                                            href={link.href}
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{
                                                display: 'flex', alignItems: 'center', gap: 12,
                                                padding: '12px 14px', borderRadius: 12,
                                                color: isActive ? '#34d399' : link.featured ? '#e2e8f0' : '#94a3b8',
                                                fontWeight: link.featured ? 600 : 500,
                                                textDecoration: 'none',
                                                backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                                borderLeft: link.featured ? `2px solid ${isActive ? '#34d399' : 'rgba(52,211,153,0.3)'}` : undefined,
                                                paddingLeft: link.featured ? 12 : undefined,
                                            }}
                                        >
                                            <link.icon style={{ width: 20, height: 20 }} />
                                            <span>{link.label}</span>
                                        </Link>
                                    )
                                })}
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
                    <nav style={{ flex: 1, padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 1, overflowY: 'auto' }}>
                        {sidebarLinks.map((item, idx) => {
                            if ('separator' in item) {
                                return (
                                    <div key={`sep-${idx}`} style={{ margin: '4px 0 2px', padding: collapsed ? '0 4px' : '0 8px' }}>
                                        <div style={{ borderTop: '1px solid rgba(148,163,184,0.1)', paddingTop: 4 }}>
                                            {!collapsed && <span style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.label}</span>}
                                        </div>
                                    </div>
                                )
                            }
                            const link = item as NavLink
                            const isActive = pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))
                            const planHasApi2 = ['pro', 'business', 'scale'].includes(userPlan)
                            const isApiLocked = profileLoaded && link.href === '/dashboard/developers' && (apiAccessEnabled === false || (!planHasApi2 && apiAccessEnabled !== true))
                            const isApiLocked2ByPlan = isApiLocked && apiAccessEnabled !== false
                            if (isApiLocked) {
                                return (
                                    <div
                                        key={link.href}
                                        title={collapsed ? (isApiLocked2ByPlan ? 'Plan Pro requis' : 'Accès désactivé') : undefined}
                                        style={{
                                            display: 'flex', alignItems: 'center',
                                            gap: 10, padding: collapsed ? '6px' : '6px 10px',
                                            borderRadius: 8, color: '#4b5563', fontWeight: 500, fontSize: 15,
                                            cursor: 'not-allowed', userSelect: 'none',
                                            justifyContent: collapsed ? 'center' : 'space-between',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <link.icon style={{ width: 20, height: 20, flexShrink: 0 }} />
                                            {!collapsed && <span>{link.label}</span>}
                                        </div>
                                        {!collapsed && (
                                            <span style={{
                                                fontSize: 9, fontWeight: 700, padding: '2px 5px',
                                                borderRadius: 4,
                                                background: isApiLocked2ByPlan ? 'rgba(234,179,8,0.15)' : 'rgba(100,116,139,0.15)',
                                                color: isApiLocked2ByPlan ? '#ca8a04' : '#64748b',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em', whiteSpace: 'nowrap'
                                            }}>
                                                {isApiLocked2ByPlan ? 'Pro' : 'Off'}
                                            </span>
                                        )}
                                    </div>
                                )
                            }
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    title={collapsed ? link.label : undefined}
                                    style={{
                                        display: 'flex', alignItems: 'center',
                                        gap: 10, padding: collapsed ? '8px' : '8px 12px',
                                        borderRadius: 8, fontSize: 15,
                                        color: isActive ? '#34d399' : link.featured ? '#e2e8f0' : '#94a3b8',
                                        fontWeight: link.featured ? 600 : 500,
                                        textDecoration: 'none',
                                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                                        justifyContent: collapsed ? 'center' : 'flex-start',
                                        transition: 'all 0.2s ease',
                                        borderLeft: link.featured && !collapsed ? `2px solid ${isActive ? '#34d399' : 'rgba(52,211,153,0.3)'}` : undefined,
                                        paddingLeft: link.featured && !collapsed ? 8 : undefined,
                                    }}
                                >
                                    <link.icon style={{ width: 20, height: 20, flexShrink: 0 }} />
                                    {!collapsed && <span>{link.label}</span>}
                                </Link>
                            )
                        })}
                    </nav>
                </aside>
            )}

            {/* Main content */}
            <main style={{
                flex: 1,
                width: '100%',
                minWidth: 0,
                minHeight: '100vh',
                height: isMobile ? 'auto' : '100vh',
                marginLeft: isMobile ? 0 : sidebarWidth,
                paddingTop: isMobile ? '64px' : 0,
                transition: 'margin-left 0.3s ease',
                backgroundColor: '#0f172a',
                overflowX: 'hidden',
                overflowY: isMobile ? 'visible' : 'auto',
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
                        gap: 8
                    }}>
                        {/* Global Search */}
                        <GlobalSearch />

                        {/* Icônes droites groupées */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>

                        {/* Parrainage */}
                        <Link href="/dashboard/settings?tab=referral" title="Parrainage" style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{
                                padding: 10, borderRadius: 12,
                                backgroundColor: '#1e293b',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            }}>
                                <Gift style={{ width: 20, height: 20, color: '#a855f7' }} />
                            </div>
                        </Link>

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
                                                        onClick={() => handleNotificationClick(notif)}
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
                                            href="/dashboard/notifications"
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

                        {/* Aide */}
                        <Link href="/dashboard/help" title={t('help')} style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{
                                padding: 10, borderRadius: 12,
                                backgroundColor: '#1e293b',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer'
                            }}>
                                <HelpCircle style={{ width: 20, height: 20, color: '#94a3b8' }} />
                            </div>
                        </Link>

                        {/* Déconnexion */}
                        <button
                            onClick={handleLogout}
                            title={t('logout')}
                            style={{
                                padding: 10, borderRadius: 12,
                                backgroundColor: '#1e293b', border: 'none',
                                cursor: 'pointer', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}
                        >
                            <LogOut style={{ width: 20, height: 20, color: '#f87171' }} />
                        </button>

                        {/* User Avatar → Settings */}
                        <Link href="/dashboard/settings" style={{ textDecoration: 'none', flexShrink: 0 }}>
                            <div style={{
                                width: 38,
                                height: 38,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: userAvatar ? 'transparent' : 'linear-gradient(135deg, #10b981, #059669)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontSize: 15,
                                fontWeight: 600,
                                border: '2px solid rgba(16, 185, 129, 0.3)',
                                cursor: 'pointer'
                            }}>
                                {userAvatar
                                    ? <img src={userAvatar} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                    : (userName?.charAt(0)?.toUpperCase() || '?')
                                }
                            </div>
                        </Link>

                        </div>{/* fin icônes droites */}
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
                    <AppDownloadBanner
                        dismissed={appBannerDismissed}
                        onDismissed={() => setAppBannerDismissed(true)}
                    />
                    {!phoneVerified && !phoneModalDismissedSession && (
                        <PhoneVerifyModal
                            currentPhone={profilePhone}
                            onVerified={() => setPhoneVerified(true)}
                            onDismiss={() => setPhoneModalDismissedSession(true)}
                        />
                    )}

                    {testAccountBanner?.bannerMode && (
                        <TestAccountCountdownBanner
                            bannerMode={testAccountBanner.bannerMode}
                            cleanupDeadline={testAccountBanner.cleanupDeadline}
                            isExpired={testAccountBanner.isExpired}
                            showCountdown={testAccountBanner.showCountdown}
                            graceDays={testAccountBanner.graceDays}
                            emphasizeWelcome={searchParams.get('welcome') === 'test-account'}
                            isExpiredSubscriber={testAccountBanner.isExpiredSubscriber}
                            hasUnusedCredits={testAccountBanner.hasUnusedCredits}
                            isTestGraceMode={testAccountBanner.isTestGraceMode}
                        />
                    )}

                    <UpgradeModalProvider>
                        <UpgradeSessionWatcher plan={userPlan} />
                        <UpgradeModal />
                        <CurrencyProvider>
                            <BiometricLock>
                                <ToastProvider>
                                    {children}
                                </ToastProvider>
                            </BiometricLock>
                        </CurrencyProvider>
                    </UpgradeModalProvider>
                    <MobileAppPrompt />
                </div>
            </main>
        </div>
    )
}




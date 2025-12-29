'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, Menu, X, ChevronDown, Sparkles, LayoutDashboard, Globe } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useTranslations, useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'

export default function Navbar() {
    const t = useTranslations('Navigation')
    const locale = useLocale()
    const router = useRouter()
    const pathname = usePathname()

    const switchLocale = () => {
        const newLocale = locale === 'fr' ? 'en' : 'fr'
        const segments = pathname.split('/')
        if (segments.length > 1 && (segments[1] === 'fr' || segments[1] === 'en')) {
            segments[1] = newLocale
            router.push(segments.join('/'))
        } else {
            router.push(`/${newLocale}${pathname}`)
        }
    }

    const navLinks = [
        {
            label: t('product'),
            href: '#features',
            children: [
                { label: t('features'), href: '#features' },
                { label: t('howItWorks'), href: '#how-it-works' },
            ]
        },
        { label: t('pricing'), href: '#pricing' },
        { label: t('faq'), href: '#faq' },
    ]

    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
    const [isMobile, setIsMobile] = useState(false)
    const [isAuthenticated, setIsAuthenticated] = useState(false)

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20)
        const checkMobile = () => setIsMobile(window.innerWidth < 1024)

        handleScroll()
        checkMobile()

        window.addEventListener('scroll', handleScroll)
        window.addEventListener('resize', checkMobile)

        // Check authentication status
        const checkAuth = async () => {
            try {
                const supabase = createClient()
                const { data: { session } } = await supabase.auth.getSession()
                setIsAuthenticated(!!session)
            } catch (error) {
                console.error('Auth check error:', error)
            }
        }
        checkAuth()

        return () => {
            window.removeEventListener('scroll', handleScroll)
            window.removeEventListener('resize', checkMobile)
        }
    }, [])

    return (
        <>
            <motion.header
                initial={{ y: -100 }}
                animate={{ y: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    transition: 'all 0.3s ease',
                    backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.9)' : 'transparent',
                    backdropFilter: scrolled ? 'blur(20px)' : 'none',
                    borderBottom: scrolled ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                    boxShadow: scrolled ? '0 4px 20px rgba(0, 0, 0, 0.2)' : 'none'
                }}
            >
                <nav style={{
                    width: '100%',
                    maxWidth: 1280,
                    margin: '0 auto',
                    padding: '0 24px'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: 80
                    }}>
                        {/* Logo */}
                        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                style={{
                                    position: 'relative',
                                    width: 44,
                                    height: 44,
                                    borderRadius: 12,
                                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
                                }}
                            >
                                <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />
                                <div style={{
                                    position: 'absolute',
                                    top: -4,
                                    right: -4,
                                    width: 12,
                                    height: 12,
                                    background: '#a855f7',
                                    borderRadius: '50%',
                                    border: '2px solid #020617'
                                }} />
                            </motion.div>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: 20, fontWeight: 700, color: 'white', letterSpacing: '-0.025em' }}>WhatsAI</span>
                                <span style={{ fontSize: 10, color: '#34d399', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Automation</span>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        {!isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                {navLinks.map((link) => (
                                    <div
                                        key={link.label}
                                        style={{ position: 'relative' }}
                                        onMouseEnter={() => link.children && setActiveDropdown(link.label)}
                                        onMouseLeave={() => setActiveDropdown(null)}
                                    >
                                        <Link
                                            href={link.href}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 4,
                                                padding: '10px 16px',
                                                color: '#cbd5e1',
                                                fontWeight: 500,
                                                textDecoration: 'none',
                                                borderRadius: 12,
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {link.label}
                                            {link.children && (
                                                <ChevronDown style={{
                                                    width: 16,
                                                    height: 16,
                                                    transition: 'transform 0.2s ease',
                                                    transform: activeDropdown === link.label ? 'rotate(180deg)' : 'rotate(0deg)'
                                                }} />
                                            )}
                                        </Link>

                                        {/* Dropdown */}
                                        <AnimatePresence>
                                            {link.children && activeDropdown === link.label && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 10 }}
                                                    transition={{ duration: 0.2 }}
                                                    style={{
                                                        position: 'absolute',
                                                        top: '100%',
                                                        left: 0,
                                                        marginTop: 8,
                                                        width: 224,
                                                        background: 'rgba(15, 23, 42, 0.95)',
                                                        backdropFilter: 'blur(20px)',
                                                        border: '1px solid rgba(148, 163, 184, 0.1)',
                                                        borderRadius: 16,
                                                        overflow: 'hidden',
                                                        padding: 8
                                                    }}
                                                >
                                                    {link.children.map((child) => (
                                                        <Link
                                                            key={child.label}
                                                            href={child.href}
                                                            style={{
                                                                display: 'block',
                                                                padding: '12px 16px',
                                                                color: '#cbd5e1',
                                                                textDecoration: 'none',
                                                                borderRadius: 12,
                                                                transition: 'all 0.2s ease'
                                                            }}
                                                        >
                                                            {child.label}
                                                        </Link>
                                                    ))}
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* CTA Buttons - Desktop */}
                        {!isMobile && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={switchLocale}
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: 8,
                                        cursor: 'pointer',
                                        padding: '8px 12px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        color: '#cbd5e1',
                                        fontSize: 13,
                                        fontWeight: 600,
                                        marginRight: 8
                                    }}
                                >
                                    <Globe style={{ width: 14, height: 14 }} />
                                    <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
                                </motion.button>
                                {isAuthenticated ? (
                                    // User is logged in - show Dashboard button
                                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                padding: '12px 24px',
                                                fontWeight: 600,
                                                fontSize: 15,
                                                borderRadius: 14,
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                                color: 'white',
                                                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                                            }}
                                        >
                                            <LayoutDashboard style={{ width: 16, height: 16 }} />
                                            {t('dashboard')}
                                        </motion.button>
                                    </Link>
                                ) : (
                                    // User is not logged in - show Connexion and Essai gratuit
                                    <>
                                        <Link
                                            href="/login"
                                            style={{
                                                padding: '10px 20px',
                                                color: '#cbd5e1',
                                                fontWeight: 500,
                                                textDecoration: 'none',
                                                transition: 'color 0.2s ease'
                                            }}
                                        >
                                            {t('login')}
                                        </Link>
                                        <Link href="/register" style={{ textDecoration: 'none' }}>
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    padding: '12px 24px',
                                                    fontWeight: 600,
                                                    fontSize: 15,
                                                    borderRadius: 14,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                                    color: 'white',
                                                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                                                }}
                                            >
                                                <Sparkles style={{ width: 16, height: 16 }} />
                                                {t('register')}
                                            </motion.button>
                                        </Link>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Mobile Menu Button */}
                        {isMobile && (
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                style={{
                                    padding: 10,
                                    borderRadius: 12,
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)',
                                    cursor: 'pointer'
                                }}
                            >
                                {mobileMenuOpen ? (
                                    <X style={{ width: 24, height: 24, color: 'white' }} />
                                ) : (
                                    <Menu style={{ width: 24, height: 24, color: 'white' }} />
                                )}
                            </motion.button>
                        )}
                    </div>
                </nav>
            </motion.header>

            {/* Mobile Menu */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                position: 'fixed',
                                inset: 0,
                                background: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)',
                                zIndex: 40
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            style={{
                                position: 'fixed',
                                top: 0,
                                right: 0,
                                bottom: 0,
                                width: 320,
                                background: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(40px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)',
                                zIndex: 50
                            }}
                        >
                            <div style={{ padding: 24 }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                                    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                                        <div style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 12,
                                            background: 'linear-gradient(135deg, #10b981, #34d399)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                                        </div>
                                        <span style={{ fontSize: 20, fontWeight: 700, color: 'white' }}>WhatsAI</span>
                                    </Link>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <button
                                            onClick={switchLocale}
                                            style={{
                                                padding: 8,
                                                borderRadius: 12,
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: 'none',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 6,
                                                color: 'white',
                                                fontWeight: 600,
                                                fontSize: 14
                                            }}
                                        >
                                            <Globe style={{ width: 18, height: 18 }} />
                                            {locale === 'fr' ? 'EN' : 'FR'}
                                        </button>
                                        <button
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{
                                                padding: 8,
                                                borderRadius: 12,
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: 'none',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <X style={{ width: 20, height: 20, color: 'white' }} />
                                        </button>
                                    </div>
                                </div>

                                <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {navLinks.map((link) => (
                                        <div key={link.label}>
                                            <Link
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '12px 16px',
                                                    color: '#e2e8f0',
                                                    textDecoration: 'none',
                                                    borderRadius: 12,
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {link.label}
                                                {link.children && <ChevronDown style={{ width: 16, height: 16 }} />}
                                            </Link>
                                            {link.children && (
                                                <div style={{ marginLeft: 16, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    {link.children.map((child) => (
                                                        <Link
                                                            key={child.label}
                                                            href={child.href}
                                                            onClick={() => setMobileMenuOpen(false)}
                                                            style={{
                                                                display: 'block',
                                                                padding: '8px 16px',
                                                                fontSize: 14,
                                                                color: '#94a3b8',
                                                                textDecoration: 'none',
                                                                borderRadius: 12
                                                            }}
                                                        >
                                                            {child.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </nav>

                                <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {isAuthenticated ? (
                                        <Link
                                            href="/dashboard"
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <button style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: 8,
                                                width: '100%',
                                                padding: '12px 24px',
                                                fontWeight: 600,
                                                fontSize: 15,
                                                borderRadius: 14,
                                                border: 'none',
                                                cursor: 'pointer',
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                                color: 'white'
                                            }}>
                                                <LayoutDashboard style={{ width: 16, height: 16 }} />
                                                {t('dashboard')}
                                            </button>
                                        </Link>
                                    ) : (
                                        <>
                                            <Link
                                                href="/login"
                                                onClick={() => setMobileMenuOpen(false)}
                                                style={{
                                                    display: 'block',
                                                    width: '100%',
                                                    padding: '12px',
                                                    textAlign: 'center',
                                                    color: '#e2e8f0',
                                                    background: 'rgba(255, 255, 255, 0.05)',
                                                    borderRadius: 12,
                                                    textDecoration: 'none'
                                                }}
                                            >
                                                {t('login')}
                                            </Link>
                                            <Link
                                                href="/register"
                                                onClick={() => setMobileMenuOpen(false)}
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <button style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                    width: '100%',
                                                    padding: '12px 24px',
                                                    fontWeight: 600,
                                                    fontSize: 15,
                                                    borderRadius: 14,
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                                    color: 'white'
                                                }}>
                                                    <Sparkles style={{ width: 16, height: 16 }} />
                                                    {t('register')}
                                                </button>
                                            </Link>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    )
}

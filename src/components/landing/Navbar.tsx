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
                className="fixed top-0 left-0 right-0 z-50"
                style={{
                    transition: 'all 0.3s ease',
                    backgroundColor: scrolled ? 'rgba(15, 23, 42, 0.9)' : 'transparent',
                    backdropFilter: scrolled ? 'blur(20px)' : 'none',
                    borderBottom: scrolled ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                    boxShadow: scrolled ? '0 4px 20px rgba(0, 0, 0, 0.2)' : 'none'
                }}
            >
                <nav className="w-full max-w-[1280px] mx-auto px-6">
                    <div className="flex items-center justify-between h-20">
                        {/* Logo */}
                        <Link href="/" className="flex items-center gap-3 no-underline">
                            <motion.div
                                whileHover={{ scale: 1.05, rotate: 5 }}
                                className="relative w-11 h-11 rounded-[12px] flex items-center justify-center"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
                                }}
                            >
                                <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#a855f7] rounded-full border-2 border-[#020617]" />
                            </motion.div>
                            <div className="flex flex-col">
                                <span className="text-xl font-bold text-white -tracking-tight">WazzapAI</span>
                                <span className="text-[10px] text-[#34d399] font-medium uppercase tracking-[0.1em]">Automation</span>
                            </div>
                        </Link>

                        {/* Desktop Navigation */}
                        {!isMobile && (
                            <div className="flex items-center gap-1">
                                {navLinks.map((link) => (
                                    <div
                                        key={link.label}
                                        className="relative"
                                        onMouseEnter={() => link.children && setActiveDropdown(link.label)}
                                        onMouseLeave={() => setActiveDropdown(null)}
                                    >
                                        <Link
                                            href={link.href}
                                            className="flex items-center gap-1 px-4 py-[10px] text-slate-300 font-medium no-underline rounded-xl"
                                            style={{ transition: 'all 0.2s ease' }}
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
                                                    className="absolute top-full left-0 mt-2 w-56 rounded-2xl overflow-hidden p-2"
                                                    style={{
                                                        background: 'rgba(15, 23, 42, 0.95)',
                                                        backdropFilter: 'blur(20px)',
                                                        border: '1px solid rgba(148, 163, 184, 0.1)'
                                                    }}
                                                >
                                                    {link.children.map((child) => (
                                                        <Link
                                                            key={child.label}
                                                            href={child.href}
                                                            className="block px-4 py-3 text-slate-300 no-underline rounded-xl"
                                                            style={{ transition: 'all 0.2s ease' }}
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
                            <div className="flex items-center gap-3">
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={switchLocale}
                                    className="flex items-center gap-[6px] px-3 py-2 rounded-lg cursor-pointer text-slate-300 text-[13px] font-semibold mr-2"
                                    style={{
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)'
                                    }}
                                >
                                    <Globe style={{ width: 14, height: 14 }} />
                                    <span>{locale === 'fr' ? 'EN' : 'FR'}</span>
                                </motion.button>
                                {isAuthenticated ? (
                                    <Link href="/dashboard" style={{ textDecoration: 'none' }}>
                                        <motion.button
                                            whileHover={{ scale: 1.02 }}
                                            whileTap={{ scale: 0.98 }}
                                            className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-[15px] rounded-[14px] border-none cursor-pointer text-white"
                                            style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
                                                boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
                                            }}
                                        >
                                            <LayoutDashboard style={{ width: 16, height: 16 }} />
                                            {t('dashboard')}
                                        </motion.button>
                                    </Link>
                                ) : (
                                    <>
                                        <Link
                                            href="/login"
                                            className="px-5 py-[10px] text-slate-300 font-medium no-underline"
                                            style={{ transition: 'color 0.2s ease' }}
                                        >
                                            {t('login')}
                                        </Link>
                                        <Link href="/register" style={{ textDecoration: 'none' }}>
                                            <motion.button
                                                whileHover={{ scale: 1.02 }}
                                                whileTap={{ scale: 0.98 }}
                                                className="inline-flex items-center gap-2 px-6 py-3 font-semibold text-[15px] rounded-[14px] border-none cursor-pointer text-white"
                                                style={{
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
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
                                className="p-[10px] rounded-xl cursor-pointer"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.05)',
                                    border: '1px solid rgba(255, 255, 255, 0.1)'
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
                            className="fixed inset-0 z-40"
                            style={{
                                background: 'rgba(0, 0, 0, 0.6)',
                                backdropFilter: 'blur(4px)'
                            }}
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="fixed top-0 right-0 bottom-0 w-80 z-50"
                            style={{
                                background: 'rgba(15, 23, 42, 0.95)',
                                backdropFilter: 'blur(40px)',
                                border: '1px solid rgba(148, 163, 184, 0.1)'
                            }}
                        >
                            <div className="p-6">
                                <div className="flex items-center justify-between mb-8">
                                    <Link href="/" className="flex items-center gap-2 no-underline">
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                                            background: 'linear-gradient(135deg, #10b981, #34d399)'
                                        }}>
                                            <MessageCircle style={{ width: 20, height: 20, color: 'white' }} />
                                        </div>
                                        <span className="text-xl font-bold text-white">WazzapAI</span>
                                    </Link>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={switchLocale}
                                            className="p-2 rounded-xl cursor-pointer flex items-center gap-[6px] text-white font-semibold text-sm"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: 'none'
                                            }}
                                        >
                                            <Globe style={{ width: 18, height: 18 }} />
                                            {locale === 'fr' ? 'EN' : 'FR'}
                                        </button>
                                        <button
                                            onClick={() => setMobileMenuOpen(false)}
                                            className="p-2 rounded-xl cursor-pointer"
                                            style={{
                                                background: 'rgba(255, 255, 255, 0.05)',
                                                border: 'none'
                                            }}
                                        >
                                            <X style={{ width: 20, height: 20, color: 'white' }} />
                                        </button>
                                    </div>
                                </div>

                                <nav className="flex flex-col gap-1">
                                    {navLinks.map((link) => (
                                        <div key={link.label}>
                                            <Link
                                                href={link.href}
                                                onClick={() => setMobileMenuOpen(false)}
                                                className="flex items-center justify-between px-4 py-3 text-slate-200 no-underline rounded-xl"
                                                style={{ transition: 'all 0.2s ease' }}
                                            >
                                                {link.label}
                                                {link.children && <ChevronDown style={{ width: 16, height: 16 }} />}
                                            </Link>
                                            {link.children && (
                                                <div className="ml-4 mt-1 flex flex-col gap-1">
                                                    {link.children.map((child) => (
                                                        <Link
                                                            key={child.label}
                                                            href={child.href}
                                                            onClick={() => setMobileMenuOpen(false)}
                                                            className="block px-4 py-2 text-sm text-slate-400 no-underline rounded-xl"
                                                        >
                                                            {child.label}
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </nav>

                                <div className="mt-8 flex flex-col gap-3">
                                    {isAuthenticated ? (
                                        <Link
                                            href="/dashboard"
                                            onClick={() => setMobileMenuOpen(false)}
                                            style={{ textDecoration: 'none' }}
                                        >
                                            <button className="flex items-center justify-center gap-2 w-full py-3 px-6 font-semibold text-[15px] rounded-[14px] border-none cursor-pointer text-white" style={{
                                                background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
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
                                                className="block w-full py-3 text-center text-slate-200 rounded-xl no-underline"
                                                style={{ background: 'rgba(255, 255, 255, 0.05)' }}
                                            >
                                                {t('login')}
                                            </Link>
                                            <Link
                                                href="/register"
                                                onClick={() => setMobileMenuOpen(false)}
                                                style={{ textDecoration: 'none' }}
                                            >
                                                <button className="flex items-center justify-center gap-2 w-full py-3 px-6 font-semibold text-[15px] rounded-[14px] border-none cursor-pointer text-white" style={{
                                                    background: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)'
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

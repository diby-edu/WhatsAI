'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, ArrowRight, Loader2, Check, ChevronDown, Phone, RefreshCw, RotateCcw, LogOut } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { PHONE_COUNTRY_CODES, buildInternationalPhone } from '@/lib/profile-phone'

const currencies = [
    { code: 'XOF' as const, symbol: 'FCFA', flag: '🌍' },
    { code: 'USD' as const, symbol: '$', flag: '🇺🇸' },
    { code: 'EUR' as const, symbol: '€', flag: '🇪🇺' },
]

const languages = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
]



export default function OnboardingPage() {
    const router = useRouter()
    const t = useTranslations('Onboarding')
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [currency, setCurrency] = useState<string | null>(null)
    const [language, setLanguage] = useState<string>('fr')
    const [selectedCountry, setSelectedCountry] = useState(PHONE_COUNTRY_CODES[0])
    const [phoneNumber, setPhoneNumber] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [dialSearch, setDialSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [otpBypassEnabled, setOtpBypassEnabled] = useState(false)

    // OTP
    const [otpStep, setOtpStep] = useState(false)
    const [otp, setOtp] = useState('')
    const [otpCountdown, setOtpCountdown] = useState(0)
    const [otpExpired, setOtpExpired] = useState(false)
    const [otpError, setOtpError] = useState<string | null>(null)
    const [verifyingOtp, setVerifyingOtp] = useState(false)

    // Auto-sélection quand l'indicatif saisi correspond exactement à un pays
    useEffect(() => {
        if (!dialSearch.startsWith('+') || dialSearch.length < 2) return
        const exact = PHONE_COUNTRY_CODES.find(c => c.dial === dialSearch)
        if (exact) {
            setSelectedCountry(exact)
            setShowDropdown(false)
            setDialSearch('')
        }
    }, [dialSearch])

    // Countdown OTP
    useEffect(() => {
        if (!otpStep || otpCountdown <= 0) return
        const t = setTimeout(() => {
            setOtpCountdown(c => {
                if (c <= 1) { setOtpExpired(true); return 0 }
                return c - 1
            })
        }, 1000)
        return () => clearTimeout(t)
    }, [otpStep, otpCountdown])

    // Détecte le bypass OTP admin pour ne jamais promettre l'envoi d'un code
    // qui ne sera pas réellement envoyé.
    useEffect(() => {
        fetch('/api/features')
            .then(r => r.json())
            .then(d => setOtpBypassEnabled(Boolean(d?.data?.flags?.otp_bypass_enabled)))
            .catch(() => {})
    }, [])

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
                setDialSearch('')
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const saveProfileAndRedirect = async (fullPhone: string) => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { router.push('/login'); return }

        // phone_verified est déjà positionné côté serveur par /api/phone-verify/confirm
        // (LM-7 : protégé par trigger, non modifiable depuis le client).
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ currency, language, onboarding_completed: true, phone: fullPhone })
            .eq('id', user.id)

        if (profileError) {
            setOtpError(t('error.saveFailed'))
            setVerifyingOtp(false)
            return
        }
        router.push(`/${language}/dashboard?welcome=test-account`)
    }

    const handleSendOtp = async () => {
        const fullPhone = buildInternationalPhone(selectedCountry.dial, phoneNumber)
        if (!currency) return
        if (!fullPhone) {
            setError(t('error.phoneRequired'))
            return
        }
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/phone-verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone }),
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || t('error.sendFailed'))
                setLoading(false)
                return
            }
            // Mode bypass : vérification automatique sans afficher le formulaire OTP
            if (data.data?.bypass) {
                const confirmRes = await fetch('/api/phone-verify/confirm', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ phone: fullPhone, code: 'BYPASS' }),
                })
                if (confirmRes.ok) {
                    await saveProfileAndRedirect(fullPhone!)
                    return
                }
            }
            setOtpStep(true)
            setOtpCountdown(180)
            setOtpExpired(false)
            setOtp('')
            setOtpError(null)
        } catch {
            setError(t('error.generic'))
        }
        setLoading(false)
    }

    const handleResendOtp = async () => {
        const fullPhone = buildInternationalPhone(selectedCountry.dial, phoneNumber)
        if (!fullPhone) return
        setOtpError(null)
        setOtp('')
        try {
            await fetch('/api/phone-verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone }),
            })
        } catch { /* silencieux */ }
        setOtpCountdown(180)
        setOtpExpired(false)
    }

    const handleVerifyOtp = async () => {
        const fullPhone = buildInternationalPhone(selectedCountry.dial, phoneNumber)
        if (!otp || otp.length < 6) { setOtpError(t('otp.error.tooShort')); return }
        setVerifyingOtp(true)
        setOtpError(null)
        try {
            const res = await fetch('/api/phone-verify/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone, code: otp }),
            })
            const data = await res.json()
            if (!res.ok) {
                setOtpError(data.error || t('otp.error.incorrect'))
                setVerifyingOtp(false)
                return
            }
            await saveProfileAndRedirect(fullPhone!)
        } catch {
            setOtpError(t('error.generic'))
            setVerifyingOtp(false)
        }
    }

    const sectionLabel = (num: number, text: string, optional = false) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, color: '#25D366', flexShrink: 0,
            }}>{num}</div>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>{text}</span>
            {optional && <span style={{ fontSize: 11, color: '#475569', marginLeft: 4 }}>— optionnel</span>}
        </div>
    )

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '32px 24px',
            overflowY: 'auto',
        }}>
            {/* Background glow */}
            <div style={{
                position: 'fixed', top: '15%', left: '50%',
                transform: 'translateX(-50%)',
                width: 700, height: 700,
                background: 'radial-gradient(circle, rgba(37,211,102,0.07) 0%, transparent 70%)',
                pointerEvents: 'none',
            }} />

            <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="onboarding-shell"
                style={{ width: '100%', position: 'relative', zIndex: 1 }}
            >
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32, justifyContent: 'center' }}>
                    <div style={{
                        width: 44, height: 44, borderRadius: 12,
                        background: 'linear-gradient(135deg, #25D366, #128C7E)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>WazzapAI</span>
                </div>

                {/* Card */}
                <div style={{
                    background: 'rgba(15, 23, 42, 0.85)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                    borderRadius: 24, padding: '36px 32px',
                    backdropFilter: 'blur(20px)',
                }}>
                    {/* Header */}
                    <div style={{ textAlign: 'center', marginBottom: 32 }}>
                        <div style={{ fontSize: 34, marginBottom: 10 }}>👋</div>
                        <h1 style={{ fontSize: 22, fontWeight: 700, color: 'white', marginBottom: 6 }}>
                            {t('title')}
                        </h1>
                        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                            {t('subtitle')}
                        </p>
                    </div>

                    {/* ── Section 1 : Devise ── */}
                    <div style={{
                        marginBottom: 24,
                        padding: '14px 16px',
                        borderRadius: 14,
                        border: '1px solid rgba(251, 191, 36, 0.22)',
                        background: 'rgba(120, 53, 15, 0.22)',
                        color: '#fef3c7',
                        fontSize: 13,
                        lineHeight: 1.6
                    }}>
                        {t('trialNotice')}
                    </div>

                    <div className="onboarding-grid">
                    <div>
                    {sectionLabel(1, t('section1Label'))}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                        {currencies.map((c) => {
                            const isSel = currency === c.code
                            return (
                                <motion.button key={c.code}
                                    whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                                    onClick={() => setCurrency(c.code)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: 14,
                                        padding: '14px 18px', borderRadius: 12,
                                        border: isSel ? '2px solid #25D366' : '1px solid rgba(148,163,184,0.1)',
                                        background: isSel ? 'rgba(37,211,102,0.08)' : 'rgba(30,41,59,0.4)',
                                        cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'all 0.2s',
                                    }}
                                >
                                    <span style={{ fontSize: 26 }}>{c.flag}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 14, fontWeight: 600, color: isSel ? '#25D366' : 'white', marginBottom: 1 }}>
                                            {c.symbol} — {t(`currencies.${c.code}.label`)}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            {t(`currencies.${c.code}.description`)} · ex: {t(`currencies.${c.code}.example`)}
                                        </div>
                                    </div>
                                    {isSel && (
                                        <div style={{
                                            width: 20, height: 20, borderRadius: '50%', background: '#25D366',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <Check style={{ width: 12, height: 12, color: 'white' }} />
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>
                    </div>

                    <div>
                    {/* ── Section 2 : Langue ── */}
                    {sectionLabel(2, t('section2Label'))}
                    <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
                        {languages.map((lang) => {
                            const isSel = language === lang.code
                            return (
                                <motion.button key={lang.code}
                                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                    onClick={() => setLanguage(lang.code)}
                                    style={{
                                        flex: 1, display: 'flex', alignItems: 'center',
                                        justifyContent: 'center', gap: 10,
                                        padding: '14px 18px', borderRadius: 12,
                                        border: isSel ? '2px solid #25D366' : '1px solid rgba(148,163,184,0.1)',
                                        background: isSel ? 'rgba(37,211,102,0.08)' : 'rgba(30,41,59,0.4)',
                                        cursor: 'pointer', transition: 'all 0.2s',
                                    }}
                                >
                                    <span style={{ fontSize: 22 }}>{lang.flag}</span>
                                    <span style={{ fontSize: 14, fontWeight: 600, color: isSel ? '#25D366' : 'white' }}>
                                        {lang.label}
                                    </span>
                                    {isSel && (
                                        <div style={{
                                            width: 18, height: 18, borderRadius: '50%', background: '#25D366',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                            <Check style={{ width: 11, height: 11, color: 'white' }} />
                                        </div>
                                    )}
                                </motion.button>
                            )
                        })}
                    </div>

                    {/* ── Section 3 : WhatsApp business ── */}
                    {sectionLabel(3, t('section3Label'))}
                    <p style={{ fontSize: 12, color: '#475569', marginBottom: 10, marginTop: -6 }}>
                        {t('whatsappHint')}
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                        {/* Country code selector */}
                        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                                onClick={() => { setShowDropdown(v => !v); setDialSearch('') }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    padding: '12px 12px', borderRadius: 10, height: '100%',
                                    border: '1px solid rgba(148,163,184,0.15)',
                                    background: 'rgba(30,41,59,0.5)',
                                    color: 'white', cursor: 'pointer',
                                    fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
                                }}
                            >
                                <span style={{ fontSize: 18 }}>{selectedCountry.flag}</span>
                                <span>{selectedCountry.dial}</span>
                                <ChevronDown style={{ width: 14, height: 14, color: '#64748b' }} />
                            </button>

                            <AnimatePresence>
                                {showDropdown && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.15 }}
                                        onWheel={e => e.stopPropagation()}
                                        style={{
                                            position: 'absolute', top: '110%', left: 0, zIndex: 50,
                                            background: '#0f172a',
                                            border: '1px solid rgba(148,163,184,0.15)',
                                            borderRadius: 12, width: 240,
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {/* Recherche par indicatif ou nom */}
                                        <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                            <input
                                                autoFocus
                                                type="text"
                                                placeholder={t('dialSearchPlaceholder')}
                                                value={dialSearch}
                                                onChange={e => setDialSearch(e.target.value)}
                                                style={{
                                                    width: '100%', boxSizing: 'border-box',
                                                    padding: '7px 10px', borderRadius: 8,
                                                    border: '1px solid rgba(148,163,184,0.2)',
                                                    background: 'rgba(30,41,59,0.8)',
                                                    color: 'white', fontSize: 13,
                                                    outline: 'none',
                                                }}
                                            />
                                        </div>
                                        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                                        {PHONE_COUNTRY_CODES.filter(c =>
                                            !dialSearch ||
                                            c.dial.includes(dialSearch) ||
                                            c.name.toLowerCase().includes(dialSearch.toLowerCase())
                                        ).map((country) => (
                                            <button
                                                key={country.dial + country.name}
                                                onClick={() => { setSelectedCountry(country); setShowDropdown(false); setDialSearch('') }}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 10,
                                                    width: '100%', padding: '10px 14px',
                                                    background: selectedCountry.dial === country.dial && selectedCountry.name === country.name
                                                        ? 'rgba(37,211,102,0.1)' : 'transparent',
                                                    border: 'none', cursor: 'pointer',
                                                    color: 'white', fontSize: 13, textAlign: 'left',
                                                    transition: 'background 0.15s',
                                                }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(148,163,184,0.08)')}
                                                onMouseLeave={e => (e.currentTarget.style.background =
                                                    selectedCountry.dial === country.dial && selectedCountry.name === country.name
                                                        ? 'rgba(37,211,102,0.1)' : 'transparent'
                                                )}
                                            >
                                                <span style={{ fontSize: 18 }}>{country.flag}</span>
                                                <span style={{ flex: 1, color: '#cbd5e1' }}>{country.name}</span>
                                                <span style={{ color: '#64748b', fontSize: 12 }}>{country.dial}</span>
                                            </button>
                                        ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Phone number input */}
                        <div style={{ flex: 1, position: 'relative' }}>
                            <Phone style={{
                                position: 'absolute', left: 12, top: '50%',
                                transform: 'translateY(-50%)',
                                width: 15, height: 15, color: '#475569',
                            }} />
                            <input
                                type="tel"
                                placeholder={t('phonePlaceholder')}
                                value={phoneNumber}
                                onChange={e => { setPhoneNumber(e.target.value.replace(/\D/g, '')); if (error) setError(null) }}
                                style={{
                                    width: '100%', padding: '12px 14px 12px 34px',
                                    borderRadius: 10, boxSizing: 'border-box',
                                    border: '1px solid rgba(148,163,184,0.15)',
                                    background: 'rgba(30,41,59,0.5)',
                                    color: 'white', fontSize: 14, outline: 'none',
                                }}
                            />
                        </div>
                    </div>
                    </div>
                    </div>

                    {/* Error */}
                    {error && (
                        <div style={{
                            padding: '11px 14px', borderRadius: 10,
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5', fontSize: 13, marginBottom: 16,
                        }}>
                            {error}
                        </div>
                    )}

                    {/* Étape OTP */}
                    {otpStep ? (
                        <div>
                            <p style={{ fontSize: 13, color: '#94a3b8', textAlign: 'center', marginBottom: 16 }}>
                                {t('otp.sentTo')} <strong style={{ color: 'white' }}>{buildInternationalPhone(selectedCountry.dial, phoneNumber)}</strong>
                            </p>

                            {/* Champ code */}
                            <input
                                type="number"
                                placeholder={t('otp.codePlaceholder')}
                                value={otp}
                                maxLength={6}
                                onChange={e => { setOtp(e.target.value.slice(0, 6)); setOtpError(null) }}
                                style={{
                                    width: '100%', boxSizing: 'border-box',
                                    padding: '16px', borderRadius: 12, border: '1px solid rgba(148,163,184,0.2)',
                                    background: 'rgba(30,41,59,0.6)', color: 'white',
                                    fontSize: 24, fontWeight: 700, textAlign: 'center',
                                    outline: 'none', letterSpacing: 8, marginBottom: 12,
                                }}
                            />

                            {otpError && (
                                <div style={{
                                    padding: '10px 14px', borderRadius: 10,
                                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                    color: '#fca5a5', fontSize: 13, marginBottom: 12,
                                }}>
                                    {otpError}
                                </div>
                            )}

                            {/* Bouton Vérifier */}
                            <motion.button
                                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                                onClick={handleVerifyOtp}
                                disabled={verifyingOtp || otp.length < 6}
                                style={{
                                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                                    background: otp.length === 6 ? 'linear-gradient(135deg, #25D366, #128C7E)' : 'rgba(30,41,59,0.6)',
                                    color: otp.length === 6 ? 'white' : '#475569',
                                    fontWeight: 600, fontSize: 15, cursor: otp.length === 6 && !verifyingOtp ? 'pointer' : 'not-allowed',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    marginBottom: 16,
                                }}
                            >
                                {verifyingOtp
                                    ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> {t('otp.verifying')}</>
                                    : <><Check style={{ width: 18, height: 18 }} /> {t('otp.verifyButton')}</>
                                }
                            </motion.button>

                            {/* Countdown + actions */}
                            {!otpExpired ? (
                                <p style={{ textAlign: 'center', color: '#475569', fontSize: 13 }}>
                                    {t('otp.expiresIn')}{' '}
                                    <span style={{ color: '#94a3b8', fontWeight: 600 }}>
                                        {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
                                    </span>
                                </p>
                            ) : (
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                        onClick={handleResendOtp}
                                        style={{
                                            flex: 1, padding: '12px', borderRadius: 10,
                                            border: '1px solid rgba(37,211,102,0.3)',
                                            background: 'rgba(37,211,102,0.06)',
                                            color: '#25D366', fontWeight: 600, fontSize: 13,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                    >
                                        <RefreshCw size={14} /> {t('otp.resend')}
                                    </button>
                                    <button
                                        onClick={() => { setOtpStep(false); setOtp(''); setOtpError(null) }}
                                        style={{
                                            flex: 1, padding: '12px', borderRadius: 10,
                                            border: '1px solid rgba(148,163,184,0.15)',
                                            background: 'rgba(255,255,255,0.03)',
                                            color: '#64748b', fontWeight: 500, fontSize: 13,
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        }}
                                    >
                                        <RotateCcw size={14} /> {t('otp.changeNumber')}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* CTA — Envoyer code */
                        <motion.button
                            whileHover={{ scale: currency ? 1.02 : 1 }}
                            whileTap={{ scale: currency ? 0.98 : 1 }}
                            onClick={handleSendOtp}
                            disabled={!currency || !buildInternationalPhone(selectedCountry.dial, phoneNumber) || loading}
                            style={{
                                width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                                background: currency && buildInternationalPhone(selectedCountry.dial, phoneNumber)
                                    ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                    : 'rgba(30,41,59,0.6)',
                                color: currency && buildInternationalPhone(selectedCountry.dial, phoneNumber) ? 'white' : '#475569',
                                fontWeight: 600, fontSize: 15,
                                cursor: currency && buildInternationalPhone(selectedCountry.dial, phoneNumber) && !loading ? 'pointer' : 'not-allowed',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading
                                ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> {otpBypassEnabled ? t('continueLoading') : t('sendCodeLoading')}</>
                                : <>{otpBypassEnabled ? t('continueButton') : t('sendCodeButton')} <ArrowRight style={{ width: 18, height: 18 }} /></>
                            }
                        </motion.button>
                    )}
                </div>

                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#334155' }}>
                    {t('footerNote')}
                </p>

                {/* Bouton annuler — déconnexion sans compléter l'onboarding */}
                <button
                    onClick={async () => {
                        const supabase = createClient()
                        await supabase.auth.signOut()
                        router.push('/')
                    }}
                    style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', marginTop: 16,
                        background: 'none', border: 'none',
                        color: '#475569', fontSize: 12, cursor: 'pointer',
                        padding: '8px 0',
                    }}
                >
                    <LogOut style={{ width: 13, height: 13 }} />
                    {t('cancelAndLogout')}
                </button>
            </motion.div>

            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                input::placeholder { color: #334155; }
                input:focus { border-color: rgba(37,211,102,0.4) !important; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 2px; }
                .onboarding-shell { max-width: 500px; }
                @media (min-width: 860px) {
                    .onboarding-shell { max-width: 860px; }
                    .onboarding-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
                }
            `}</style>
        </div>
    )
}


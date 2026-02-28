'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, ArrowRight, Loader2, Check, ChevronDown, Phone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const currencies = [
    { code: 'XOF', label: 'Franc CFA', symbol: 'FCFA', flag: '🌍', description: 'Afrique de l\'Ouest', example: '7 000 FCFA / mois' },
    { code: 'USD', label: 'Dollar américain', symbol: '$', flag: '🇺🇸', description: 'États-Unis', example: '$10 / mois' },
    { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺', description: 'Europe', example: '€10 / mois' },
]

const languages = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
]

const countryCodes = [
    { dial: '+225', flag: '🇨🇮', name: 'Côte d\'Ivoire' },
    { dial: '+221', flag: '🇸🇳', name: 'Sénégal' },
    { dial: '+223', flag: '🇲🇱', name: 'Mali' },
    { dial: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
    { dial: '+227', flag: '🇳🇪', name: 'Niger' },
    { dial: '+224', flag: '🇬🇳', name: 'Guinée' },
    { dial: '+228', flag: '🇹🇬', name: 'Togo' },
    { dial: '+229', flag: '🇧🇯', name: 'Bénin' },
    { dial: '+237', flag: '🇨🇲', name: 'Cameroun' },
    { dial: '+242', flag: '🇨🇬', name: 'Congo' },
    { dial: '+243', flag: '🇨🇩', name: 'RD Congo' },
    { dial: '+241', flag: '🇬🇦', name: 'Gabon' },
    { dial: '+240', flag: '🇬🇶', name: 'Guinée éq.' },
    { dial: '+236', flag: '🇨🇫', name: 'Centrafrique' },
    { dial: '+235', flag: '🇹🇩', name: 'Tchad' },
    { dial: '+212', flag: '🇲🇦', name: 'Maroc' },
    { dial: '+213', flag: '🇩🇿', name: 'Algérie' },
    { dial: '+216', flag: '🇹🇳', name: 'Tunisie' },
    { dial: '+234', flag: '🇳🇬', name: 'Nigeria' },
    { dial: '+233', flag: '🇬🇭', name: 'Ghana' },
    { dial: '+33',  flag: '🇫🇷', name: 'France' },
    { dial: '+32',  flag: '🇧🇪', name: 'Belgique' },
    { dial: '+41',  flag: '🇨🇭', name: 'Suisse' },
    { dial: '+352', flag: '🇱🇺', name: 'Luxembourg' },
    { dial: '+1',   flag: '🇺🇸', name: 'États-Unis / Canada' },
    { dial: '+44',  flag: '🇬🇧', name: 'Royaume-Uni' },
]

export default function OnboardingPage() {
    const router = useRouter()
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [currency, setCurrency] = useState<string | null>(null)
    const [language, setLanguage] = useState<string>('fr')
    const [selectedCountry, setSelectedCountry] = useState(countryCodes[0])
    const [phoneNumber, setPhoneNumber] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Close dropdown on outside click
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const handleConfirm = async () => {
        if (!currency) return
        setLoading(true)
        setError(null)

        try {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                router.push('/login')
                return
            }

            // Build full phone number in international format
            const digits = phoneNumber.trim().replace(/^0/, '').replace(/\s/g, '')
            const fullPhone = digits ? `${selectedCountry.dial}${digits}` : null

            const updateData: Record<string, unknown> = {
                currency,
                language,
                onboarding_completed: true,
            }
            if (fullPhone) updateData.phone = fullPhone

            const { error: profileError } = await supabase
                .from('profiles')
                .update(updateData)
                .eq('id', user.id)

            if (profileError) {
                setError('Erreur lors de la sauvegarde. Réessayez.')
                setLoading(false)
                return
            }

            // Update user metadata so middleware won't redirect again
            await supabase.auth.updateUser({
                data: { onboarding_completed: true }
            })

            // Redirect to dashboard in the selected language
            router.push(`/${language}/dashboard`)
        } catch {
            setError('Une erreur est survenue. Réessayez.')
            setLoading(false)
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
                style={{ width: '100%', maxWidth: 500, position: 'relative', zIndex: 1 }}
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
                            Bienvenue sur WazzapAI !
                        </h1>
                        <p style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>
                            Configurez votre compte en quelques secondes.
                        </p>
                    </div>

                    {/* ── Section 1 : Devise ── */}
                    {sectionLabel(1, 'Votre devise de travail')}
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
                                            {c.symbol} — {c.label}
                                        </div>
                                        <div style={{ fontSize: 12, color: '#64748b' }}>
                                            {c.description} · ex: {c.example}
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

                    {/* ── Section 2 : Langue ── */}
                    {sectionLabel(2, 'Langue de l\'interface')}
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
                    {sectionLabel(3, 'Numéro WhatsApp de votre entreprise', true)}
                    <p style={{ fontSize: 12, color: '#475569', marginBottom: 10, marginTop: -6 }}>
                        Nous pourrons vous contacter directement sur WhatsApp pour le support.
                    </p>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
                        {/* Country code selector */}
                        <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                            <button
                                onClick={() => setShowDropdown(!showDropdown)}
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
                                        style={{
                                            position: 'absolute', top: '110%', left: 0, zIndex: 50,
                                            background: '#0f172a',
                                            border: '1px solid rgba(148,163,184,0.15)',
                                            borderRadius: 12, width: 220,
                                            maxHeight: 260, overflowY: 'auto',
                                            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                        }}
                                    >
                                        {countryCodes.map((country) => (
                                            <button
                                                key={country.dial + country.name}
                                                onClick={() => { setSelectedCountry(country); setShowDropdown(false) }}
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
                                placeholder="07 12 34 56 78"
                                value={phoneNumber}
                                onChange={e => setPhoneNumber(e.target.value)}
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

                    {/* CTA */}
                    <motion.button
                        whileHover={{ scale: currency ? 1.02 : 1 }}
                        whileTap={{ scale: currency ? 0.98 : 1 }}
                        onClick={handleConfirm}
                        disabled={!currency || loading}
                        style={{
                            width: '100%', padding: '14px 24px', borderRadius: 12, border: 'none',
                            background: currency
                                ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                : 'rgba(30,41,59,0.6)',
                            color: currency ? 'white' : '#475569',
                            fontWeight: 600, fontSize: 15,
                            cursor: currency && !loading ? 'pointer' : 'not-allowed',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            transition: 'all 0.2s',
                        }}
                    >
                        {loading
                            ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Enregistrement…</>
                            : <>Commencer <ArrowRight style={{ width: 18, height: 18 }} /></>
                        }
                    </motion.button>
                </div>

                <p style={{ textAlign: 'center', marginTop: 14, fontSize: 11, color: '#334155' }}>
                    Ces préférences sont modifiables à tout moment dans vos paramètres.
                </p>
            </motion.div>

            <style jsx global>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                input::placeholder { color: #334155; }
                input:focus { border-color: rgba(37,211,102,0.4) !important; }
                ::-webkit-scrollbar { width: 4px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background: rgba(148,163,184,0.2); border-radius: 2px; }
            `}</style>
        </div>
    )
}

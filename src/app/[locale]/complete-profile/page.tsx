'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, ChevronDown, Loader2, MessageCircle, Phone } from 'lucide-react'
import { PHONE_COUNTRY_CODES, buildInternationalPhone } from '@/lib/profile-phone'

export default function CompleteProfilePage() {
    const router = useRouter()
    const params = useParams<{ locale: string }>()
    const dropdownRef = useRef<HTMLDivElement>(null)

    const [selectedCountry, setSelectedCountry] = useState(PHONE_COUNTRY_CODES[0])
    const [phoneNumber, setPhoneNumber] = useState('')
    const [showDropdown, setShowDropdown] = useState(false)
    const [dialSearch, setDialSearch] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const locale = params?.locale || 'fr'
    const normalizedPhone = buildInternationalPhone(selectedCountry.dial, phoneNumber)

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

    useEffect(() => {
        const handleClick = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowDropdown(false)
                setDialSearch('')
            }
        }

        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [])

    const handleSubmit = async () => {
        if (!normalizedPhone) {
            setError('Le numero de telephone est obligatoire et doit etre valide.')
            return
        }

        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: normalizedPhone }),
            })

            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                setError(json.error || 'Impossible de sauvegarder le numero de telephone.')
                return
            }

            router.push(`/${locale}/dashboard`)
            router.refresh()
        } catch {
            setError('Une erreur reseau est survenue. Veuillez reessayer.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #020617 0%, #0f172a 50%, #020617 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
        }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{ width: '100%', maxWidth: 480 }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24, justifyContent: 'center' }}>
                    <div style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'linear-gradient(135deg, #25D366, #128C7E)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <MessageCircle style={{ width: 24, height: 24, color: 'white' }} />
                    </div>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'white' }}>WazzapAI</span>
                </div>

                <div style={{
                    background: 'rgba(15, 23, 42, 0.88)',
                    border: '1px solid rgba(148, 163, 184, 0.12)',
                    borderRadius: 24,
                    padding: '36px 32px',
                    backdropFilter: 'blur(20px)',
                }}>
                    <div style={{ textAlign: 'center', marginBottom: 28 }}>
                        <h1 style={{ fontSize: 24, fontWeight: 700, color: 'white', marginBottom: 10 }}>
                            Numero de telephone requis
                        </h1>
                        <p style={{ fontSize: 14, color: '#94a3b8', lineHeight: 1.6 }}>
                            Vous devez renseigner votre numero de telephone avant d'acceder a votre tableau de bord.
                        </p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                            Numero WhatsApp de votre entreprise
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <div ref={dropdownRef} style={{ position: 'relative', flexShrink: 0 }}>
                                <button
                                    type="button"
                                    onClick={() => { setShowDropdown(prev => !prev); setDialSearch('') }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '12px 12px',
                                        borderRadius: 10,
                                        height: '100%',
                                        border: '1px solid rgba(148,163,184,0.15)',
                                        background: 'rgba(30,41,59,0.5)',
                                        color: 'white',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
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
                                                position: 'absolute',
                                                top: '110%',
                                                left: 0,
                                                zIndex: 50,
                                                background: '#0f172a',
                                                border: '1px solid rgba(148,163,184,0.15)',
                                                borderRadius: 12,
                                                width: 240,
                                                boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                                            }}
                                        >
                                            {/* Recherche par indicatif ou nom */}
                                            <div style={{ padding: '8px 10px', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>
                                                <input
                                                    autoFocus
                                                    type="text"
                                                    placeholder="+225 ou Côte d'Ivoire"
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
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedCountry(country)
                                                        setShowDropdown(false)
                                                        setDialSearch('')
                                                    }}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        width: '100%',
                                                        padding: '10px 14px',
                                                        background: selectedCountry.dial === country.dial && selectedCountry.name === country.name
                                                            ? 'rgba(37,211,102,0.1)'
                                                            : 'transparent',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        color: 'white',
                                                        fontSize: 13,
                                                        textAlign: 'left',
                                                    }}
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

                            <div style={{ flex: 1, position: 'relative' }}>
                                <Phone style={{
                                    position: 'absolute',
                                    left: 12,
                                    top: '50%',
                                    transform: 'translateY(-50%)',
                                    width: 15,
                                    height: 15,
                                    color: '#475569',
                                }} />
                                <input
                                    type="tel"
                                    placeholder="07 12 34 56 78"
                                    value={phoneNumber}
                                    onChange={(e) => {
                                        setPhoneNumber(e.target.value)
                                        if (error) setError(null)
                                    }}
                                    style={{
                                        width: '100%',
                                        padding: '12px 14px 12px 34px',
                                        borderRadius: 10,
                                        boxSizing: 'border-box',
                                        border: '1px solid rgba(148,163,184,0.15)',
                                        background: 'rgba(30,41,59,0.5)',
                                        color: 'white',
                                        fontSize: 14,
                                        outline: 'none',
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {error && (
                        <div style={{
                            padding: '11px 14px',
                            borderRadius: 10,
                            background: 'rgba(239,68,68,0.1)',
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#fca5a5',
                            fontSize: 13,
                            marginBottom: 16,
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={!normalizedPhone || loading}
                        style={{
                            width: '100%',
                            padding: '14px 24px',
                            borderRadius: 12,
                            border: 'none',
                            background: normalizedPhone
                                ? 'linear-gradient(135deg, #25D366, #128C7E)'
                                : 'rgba(30,41,59,0.6)',
                            color: normalizedPhone ? 'white' : '#475569',
                            fontWeight: 600,
                            fontSize: 15,
                            cursor: normalizedPhone && !loading ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                        }}
                    >
                        {loading
                            ? <><Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} /> Enregistrement...</>
                            : <>Continuer <ArrowRight style={{ width: 18, height: 18 }} /></>
                        }
                    </button>
                </div>

                <style jsx global>{`
                    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                    input::placeholder { color: #334155; }
                    input:focus { border-color: rgba(37,211,102,0.4) !important; }
                `}</style>
            </motion.div>
        </div>
    )
}

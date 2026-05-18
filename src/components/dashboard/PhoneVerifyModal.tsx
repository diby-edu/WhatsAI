'use client'

import { useState, useEffect } from 'react'
import { Phone, X, Loader2, Check, ChevronDown } from 'lucide-react'
import { PHONE_COUNTRY_CODES, buildInternationalPhone } from '@/lib/profile-phone'

interface Props {
    currentPhone?: string | null
    onVerified: () => void
    onDismiss?: () => void
}

const OTP_TTL = 180

export default function PhoneVerifyModal({ currentPhone, onVerified, onDismiss }: Props) {
    const [dismissed, setDismissed] = useState(false)

    // Phone input
    const defaultCountry = PHONE_COUNTRY_CODES.find(c => currentPhone?.startsWith(c.dial)) || PHONE_COUNTRY_CODES[0]
    const [selectedCountry, setSelectedCountry] = useState(defaultCountry)
    const [phoneNumber, setPhoneNumber] = useState('')
    const [showCountryList, setShowCountryList] = useState(false)

    // OTP
    const [step, setStep] = useState<'phone' | 'sending' | 'otp'>('phone')
    const [otp, setOtp] = useState('')
    const [countdown, setCountdown] = useState(0)
    const [error, setError] = useState<string | null>(null)
    const [verifying, setVerifying] = useState(false)
    const [verified, setVerified] = useState(false)

    // Pre-fill phone if available
    useEffect(() => {
        if (currentPhone) {
            const country = PHONE_COUNTRY_CODES.find(c => currentPhone.startsWith(c.dial))
            if (country) {
                setSelectedCountry(country)
                setPhoneNumber(currentPhone.slice(country.dial.length))
            }
        }
    }, [currentPhone])

    useEffect(() => {
        if (countdown <= 0) return
        const t = setTimeout(() => setCountdown(c => c - 1), 1000)
        return () => clearTimeout(t)
    }, [countdown])

    if (dismissed) return null

    const fullPhone = buildInternationalPhone(selectedCountry.dial, phoneNumber)

    const handleSend = async () => {
        if (!fullPhone) { setError('Numéro invalide'); return }
        setError(null)
        setStep('sending')
        try {
            const res = await fetch('/api/phone-verify/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Erreur'); setStep('phone'); return }
            setStep('otp')
            setCountdown(OTP_TTL)
        } catch { setError('Erreur réseau'); setStep('phone') }
    }

    const handleVerify = async () => {
        if (otp.length < 6 || verifying) return
        setVerifying(true)
        setError(null)
        try {
            const res = await fetch('/api/phone-verify/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: fullPhone, code: otp }),
            })
            const data = await res.json()
            if (!res.ok) { setError(data.error || 'Code incorrect'); setVerifying(false); return }
            setVerified(true)
            setTimeout(() => onVerified(), 1500)
        } catch { setError('Erreur réseau') }
        setVerifying(false)
    }

    const handleDismiss = () => {
        sessionStorage.setItem('phone_verify_dismissed', '1')
        setDismissed(true)
        onDismiss?.()
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
        }}>
            <div style={{
                background: 'linear-gradient(135deg, #0f172a, #1e293b)',
                border: '1px solid rgba(100,116,139,0.3)',
                borderRadius: 20, padding: 32, maxWidth: 440, width: '100%',
                position: 'relative',
            }}>
                {/* Close button (plus tard) */}
                <button
                    onClick={handleDismiss}
                    title="Plus tard"
                    style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                >
                    <X size={18} />
                </button>

                {verified ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Check size={28} color="#10b981" />
                        </div>
                        <div style={{ color: 'white', fontWeight: 700, fontSize: 18 }}>Numéro vérifié !</div>
                    </div>
                ) : (
                    <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Phone size={20} color="#10b981" />
                            </div>
                            <div>
                                <div style={{ color: 'white', fontWeight: 700, fontSize: 17 }}>Vérifiez votre numéro WhatsApp</div>
                                <div style={{ color: '#94a3b8', fontSize: 13 }}>Nécessaire pour recevoir des alertes et l'assistance</div>
                            </div>
                        </div>

                        {step !== 'otp' ? (
                            <>
                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                    {/* Country selector */}
                                    <div style={{ position: 'relative' }}>
                                        <button
                                            onClick={() => setShowCountryList(v => !v)}
                                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '12px 10px', borderRadius: 10, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.3)', color: 'white', cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap' }}
                                        >
                                            {selectedCountry.flag} {selectedCountry.dial} <ChevronDown size={12} />
                                        </button>
                                        {showCountryList && (
                                            <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, background: '#1e293b', border: '1px solid rgba(100,116,139,0.3)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', minWidth: 200 }}>
                                                {PHONE_COUNTRY_CODES.map(c => (
                                                    <div key={c.dial + c.name} onClick={() => { setSelectedCountry(c); setShowCountryList(false) }} style={{ padding: '8px 12px', cursor: 'pointer', color: 'white', fontSize: 13, display: 'flex', gap: 8 }}>
                                                        {c.flag} {c.name} {c.dial}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Phone input */}
                                    <input
                                        type="tel"
                                        value={phoneNumber}
                                        onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                                        placeholder="0141859625"
                                        style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.3)', color: 'white', fontSize: 14 }}
                                    />
                                </div>
                                {error && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>{error}</div>}
                                <button
                                    onClick={handleSend}
                                    disabled={!fullPhone || step === 'sending'}
                                    style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: fullPhone ? 'linear-gradient(135deg,#10b981,#0891b2)' : 'rgba(100,116,139,0.2)', color: 'white', fontWeight: 700, fontSize: 15, cursor: fullPhone ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                                >
                                    {step === 'sending' ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                                    Recevoir mon code WhatsApp
                                </button>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12 }}>
                                    Code envoyé au <strong style={{ color: 'white' }}>{fullPhone}</strong>
                                    {countdown > 0 && <span> — {Math.floor(countdown/60)}:{String(countdown%60).padStart(2,'0')}</span>}
                                </div>
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={otp}
                                    onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                                    placeholder="Code à 6 chiffres"
                                    style={{ width: '100%', padding: '14px', borderRadius: 12, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(100,116,139,0.3)', color: 'white', fontSize: 22, letterSpacing: 8, textAlign: 'center', marginBottom: 12, boxSizing: 'border-box' }}
                                    autoFocus
                                />
                                {error && <div style={{ fontSize: 13, color: '#f87171', marginBottom: 8 }}>{error}</div>}
                                <button
                                    onClick={handleVerify}
                                    disabled={otp.length < 6 || verifying}
                                    style={{ width: '100%', padding: '13px', borderRadius: 12, border: 'none', background: otp.length === 6 ? '#10b981' : 'rgba(100,116,139,0.2)', color: 'white', fontWeight: 700, fontSize: 15, cursor: otp.length === 6 ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}
                                >
                                    {verifying ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
                                    Vérifier le code
                                </button>
                                {countdown === 0 && (
                                    <button onClick={() => { setStep('phone'); setOtp(''); setError(null) }} style={{ width: '100%', background: 'none', border: 'none', color: '#60a5fa', fontSize: 13, cursor: 'pointer' }}>
                                        Modifier le numéro / Renvoyer
                                    </button>
                                )}
                            </>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

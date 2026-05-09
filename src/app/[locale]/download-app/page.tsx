'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { MessageCircle, Bell, Zap, Shield, Star } from 'lucide-react'
import { PLAY_STORE_URL } from '@/lib/utils'

const COUNTDOWN = 20

const features = [
    { icon: Bell, text: 'Notifications instantanées' },
    { icon: Zap, text: 'Réponses ultra-rapides' },
    { icon: Shield, text: 'Connexion sécurisée' },
]

export default function DownloadAppPage() {
    const router = useRouter()
    const locale = useLocale()
    const [seconds, setSeconds] = useState(COUNTDOWN)

    useEffect(() => {
        fetch('/api/android-dismiss', { method: 'POST' }).catch(() => {})
    }, [])

    useEffect(() => {
        if (seconds <= 0) {
            router.push(`/${locale}/dashboard`)
            return
        }
        const t = setTimeout(() => setSeconds(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [seconds, router, locale])

    const handleContinue = async () => {
        try {
            await fetch('/api/android-dismiss?permanent=1', { method: 'POST' })
        } catch { /* silencieux */ }
        router.push(`/${locale}/dashboard`)
    }

    const progress = ((COUNTDOWN - seconds) / COUNTDOWN) * 100
    const radius = 28
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(160deg, #0a0f1e 0%, #0f1f2e 50%, #0a160f 100%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '32px 24px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
        }}>
            {/* Glow background */}
            <div style={{
                position: 'absolute',
                width: 400, height: 400,
                borderRadius: '50%',
                background: 'radial-gradient(circle, rgba(16,185,129,0.08) 0%, transparent 70%)',
                top: '50%', left: '50%',
                transform: 'translate(-50%, -60%)',
                pointerEvents: 'none',
            }} />

            {/* Logo + app name */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
                <div style={{
                    width: 84, height: 84, borderRadius: 24,
                    background: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                    boxShadow: '0 0 0 12px rgba(16,185,129,0.08), 0 20px 60px rgba(16,185,129,0.25)',
                }}>
                    <MessageCircle style={{ width: 42, height: 42, color: 'white' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    {[1,2,3,4,5].map(i => (
                        <Star key={i} size={14} style={{ color: '#f59e0b', fill: '#f59e0b' }} />
                    ))}
                </div>
                <span style={{ color: '#64748b', fontSize: 12 }}>4.8 · Google Play</span>
            </div>

            {/* Texte principal */}
            <h1 style={{
                color: 'white', fontSize: 28, fontWeight: 800,
                textAlign: 'center', margin: '0 0 8px', lineHeight: 1.2,
                letterSpacing: '-0.5px',
            }}>
                Meilleure expérience<br />sur l&apos;app
            </h1>
            <p style={{
                color: '#64748b', fontSize: 15, textAlign: 'center',
                lineHeight: 1.7, maxWidth: 300, margin: '0 0 36px',
            }}>
                Gérez vos agents WhatsApp et recevez les alertes en temps réel depuis l&apos;application native.
            </p>

            {/* Feature pills */}
            <div style={{
                display: 'flex', flexDirection: 'column', gap: 10,
                width: '100%', maxWidth: 300, marginBottom: 40,
            }}>
                {features.map(({ icon: Icon, text }) => (
                    <div key={text} style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 12, padding: '12px 16px',
                    }}>
                        <div style={{
                            width: 32, height: 32, borderRadius: 8,
                            background: 'rgba(16,185,129,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            flexShrink: 0,
                        }}>
                            <Icon size={16} style={{ color: '#10b981' }} />
                        </div>
                        <span style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 500 }}>{text}</span>
                    </div>
                ))}
            </div>

            {/* Bouton Play Store */}
            <div style={{ width: '100%', maxWidth: 300, marginBottom: 12 }}>
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                    <button style={{
                        width: '100%', padding: '18px',
                        borderRadius: 16, border: 'none',
                        background: 'linear-gradient(135deg, #10b981 0%, #0891b2 100%)',
                        color: 'white', fontWeight: 700, fontSize: 17,
                        cursor: 'pointer', letterSpacing: '0.2px',
                        boxShadow: '0 8px 32px rgba(16,185,129,0.35)',
                    }}>
                        Télécharger sur Google Play
                    </button>
                </a>
            </div>

            {/* Bouton continuer + countdown */}
            <div style={{ width: '100%', maxWidth: 300 }}>
                <button
                    onClick={handleContinue}
                    style={{
                        width: '100%', padding: '15px',
                        borderRadius: 16,
                        border: '1px solid rgba(148,163,184,0.15)',
                        background: 'rgba(255,255,255,0.03)',
                        color: '#64748b', fontWeight: 500, fontSize: 14,
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    }}
                >
                    {/* Mini cercle countdown */}
                    <svg width={28} height={28} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
                        <circle cx={14} cy={14} r={radius}
                            fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth={3} />
                        <circle cx={14} cy={14} r={radius}
                            fill="none" stroke="#10b981" strokeWidth={3}
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                        />
                    </svg>
                    Continuer dans le navigateur · {seconds}s
                </button>
            </div>
        </div>
    )
}

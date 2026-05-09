'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { MessageCircle, Smartphone } from 'lucide-react'
import { PLAY_STORE_URL } from '@/lib/utils'

const COUNTDOWN = 10

export default function DownloadAppPage() {
    const router = useRouter()
    const locale = useLocale()
    const [seconds, setSeconds] = useState(COUNTDOWN)

    useEffect(() => {
        if (seconds <= 0) {
            router.push(`/${locale}/dashboard`)
            return
        }
        const t = setTimeout(() => setSeconds(s => s - 1), 1000)
        return () => clearTimeout(t)
    }, [seconds, router, locale])

    const handleContinue = async () => {
        // Poser le cookie via l'API puis rediriger
        try {
            await fetch('/api/android-dismiss', { method: 'POST' })
        } catch { /* silencieux */ }
        router.push(`/${locale}/dashboard`)
    }

    const progress = ((COUNTDOWN - seconds) / COUNTDOWN) * 100
    const radius = 36
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progress / 100) * circumference

    return (
        <div style={{
            minHeight: '100vh',
            backgroundColor: '#0f172a',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* Logo */}
            <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24,
                boxShadow: '0 0 40px rgba(16, 185, 129, 0.3)'
            }}>
                <MessageCircle style={{ width: 36, height: 36, color: 'white' }} />
            </div>

            {/* Titre */}
            <h1 style={{
                color: 'white', fontSize: 26, fontWeight: 800,
                textAlign: 'center', margin: '0 0 12px'
            }}>
                WazzapAI est sur Android
            </h1>
            <p style={{
                color: '#94a3b8', fontSize: 15, textAlign: 'center',
                lineHeight: 1.6, maxWidth: 320, margin: '0 0 48px'
            }}>
                Gérez vos agents, recevez les alertes en temps réel et répondez à vos clients depuis l&apos;application native.
            </p>

            {/* Compte à rebours circulaire */}
            <div style={{ position: 'relative', marginBottom: 48 }}>
                <svg width={100} height={100} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                        cx={50} cy={50} r={radius}
                        fill="none"
                        stroke="rgba(148,163,184,0.15)"
                        strokeWidth={6}
                    />
                    <circle
                        cx={50} cy={50} r={radius}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth={6}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        style={{ transition: 'stroke-dashoffset 0.9s linear' }}
                    />
                </svg>
                <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center'
                }}>
                    <span style={{ color: 'white', fontSize: 28, fontWeight: 800, lineHeight: 1 }}>
                        {seconds}
                    </span>
                    <span style={{ color: '#64748b', fontSize: 10 }}>sec</span>
                </div>
            </div>

            {/* Boutons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 320 }}>
                <a
                    href={PLAY_STORE_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ textDecoration: 'none' }}
                >
                    <button style={{
                        width: '100%', padding: '18px',
                        borderRadius: 16, border: 'none',
                        background: 'linear-gradient(135deg, #10b981, #0891b2)',
                        color: 'white', fontWeight: 700, fontSize: 17,
                        cursor: 'pointer', display: 'flex',
                        alignItems: 'center', justifyContent: 'center', gap: 10
                    }}>
                        <Smartphone size={22} />
                        Télécharger sur Google Play
                    </button>
                </a>

                <button
                    onClick={handleContinue}
                    style={{
                        width: '100%', padding: '16px',
                        borderRadius: 16,
                        border: '1px solid rgba(148,163,184,0.2)',
                        background: 'transparent', color: '#94a3b8',
                        fontWeight: 500, fontSize: 15, cursor: 'pointer'
                    }}
                >
                    Continuer dans le navigateur
                </button>
            </div>

            <p style={{
                color: '#334155', fontSize: 12,
                marginTop: 32, textAlign: 'center'
            }}>
                Redirection automatique dans {seconds} seconde{seconds > 1 ? 's' : ''}
            </p>
        </div>
    )
}

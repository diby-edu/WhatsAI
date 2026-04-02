'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Clock4, ShieldAlert } from 'lucide-react'

type TestAccountBannerProps = {
    cleanupDeadline: string | null
    isExpired: boolean
    showCountdown: boolean
    graceDays: number
    emphasizeWelcome?: boolean
}

function formatRemainingDuration(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const days = Math.floor(totalSeconds / 86400)
    const hours = Math.floor((totalSeconds % 86400) / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60

    return { days, hours, minutes, seconds }
}

export function TestAccountCountdownBanner({
    cleanupDeadline,
    isExpired,
    showCountdown,
    graceDays,
    emphasizeWelcome = false,
}: TestAccountBannerProps) {
    const deadlineMs = cleanupDeadline ? new Date(cleanupDeadline).getTime() : null
    const [remainingMs, setRemainingMs] = useState(() => deadlineMs ? Math.max(0, deadlineMs - Date.now()) : 0)

    useEffect(() => {
        if (!deadlineMs || (!showCountdown && !isExpired)) return

        const updateCountdown = () => {
            setRemainingMs(Math.max(0, deadlineMs - Date.now()))
        }

        updateCountdown()
        const interval = window.setInterval(updateCountdown, 1000)
        return () => window.clearInterval(interval)
    }, [deadlineMs, isExpired, showCountdown])

    const countdown = useMemo(() => formatRemainingDuration(remainingMs), [remainingMs])
    const formattedDeadline = cleanupDeadline
        ? new Date(cleanupDeadline).toLocaleString('fr-FR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        })
        : null

    if (!cleanupDeadline || (!showCountdown && !isExpired)) return null

    const title = isExpired
        ? 'Compte de test arrive a echeance'
        : emphasizeWelcome
            ? 'Bienvenue - votre compte test dispose de 7 jours'
            : 'Compte de test en attente de validation'

    const description = isExpired
        ? 'Votre delai de grace est termine. Effectuez un paiement valide ou connectez un agent WhatsApp complet pour sortir immediatement du statut test.'
        : `Sans paiement valide ni connexion complete d'un agent WhatsApp, ce compte gratuit pourra etre supprime automatiquement dans ${graceDays} jours.`

    return (
        <div
            style={{
                marginBottom: 20,
                padding: 20,
                borderRadius: 18,
                border: isExpired ? '1px solid rgba(248, 113, 113, 0.35)' : '1px solid rgba(251, 191, 36, 0.28)',
                background: isExpired
                    ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.35), rgba(69, 10, 10, 0.22))'
                    : 'linear-gradient(135deg, rgba(120, 53, 15, 0.34), rgba(15, 23, 42, 0.72))',
                boxShadow: isExpired
                    ? '0 10px 30px rgba(127, 29, 29, 0.18)'
                    : '0 10px 30px rgba(120, 53, 15, 0.16)',
            }}
        >
            <div
                style={{
                    display: 'flex',
                    gap: 14,
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                }}
            >
                <div
                    style={{
                        width: 46,
                        height: 46,
                        borderRadius: 14,
                        background: isExpired ? 'rgba(239, 68, 68, 0.16)' : 'rgba(251, 191, 36, 0.16)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                    }}
                >
                    {isExpired ? (
                        <ShieldAlert style={{ width: 22, height: 22, color: '#fca5a5' }} />
                    ) : (
                        <Clock4 style={{ width: 22, height: 22, color: '#fbbf24' }} />
                    )}
                </div>

                <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 700 }}>
                            {title}
                        </h3>
                        <span
                            style={{
                                padding: '4px 10px',
                                borderRadius: 999,
                                fontSize: 12,
                                fontWeight: 700,
                                color: isExpired ? '#fecaca' : '#fde68a',
                                background: isExpired ? 'rgba(153, 27, 27, 0.28)' : 'rgba(120, 53, 15, 0.4)',
                            }}
                        >
                            {isExpired ? 'Action requise' : 'Compte test'}
                        </span>
                    </div>

                    <p style={{ margin: '0 0 12px 0', color: '#e2e8f0', lineHeight: 1.6, fontSize: 14 }}>
                        {description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                        <AlertTriangle style={{ width: 16, height: 16, color: isExpired ? '#fca5a5' : '#fbbf24' }} />
                        <span style={{ color: '#cbd5e1', fontSize: 13 }}>
                            Pour conserver votre espace, validez un paiement ou connectez un agent WhatsApp complet.
                        </span>
                    </div>

                    {formattedDeadline && (
                        <p style={{ margin: '0 0 14px 0', color: '#94a3b8', fontSize: 13 }}>
                            Echeance : {formattedDeadline}
                        </p>
                    )}

                    {!isExpired && (
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))',
                                gap: 10,
                                maxWidth: 460,
                            }}
                        >
                            {[
                                { label: 'Jours', value: countdown.days },
                                { label: 'Heures', value: countdown.hours },
                                { label: 'Minutes', value: countdown.minutes },
                                { label: 'Secondes', value: countdown.seconds },
                            ].map((item) => (
                                <div
                                    key={item.label}
                                    style={{
                                        padding: '12px 10px',
                                        borderRadius: 14,
                                        background: 'rgba(15, 23, 42, 0.55)',
                                        border: '1px solid rgba(148, 163, 184, 0.12)',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{ color: 'white', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                                        {String(item.value).padStart(2, '0')}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>
                                        {item.label}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default TestAccountCountdownBanner

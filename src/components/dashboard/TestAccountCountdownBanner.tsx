'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, ChevronDown, ChevronUp, Clock4, ShieldAlert } from 'lucide-react'
import Link from 'next/link'

type BannerMode = 'test' | 'paid_grace' | 'paid_expired'

type TestAccountBannerProps = {
    bannerMode?: BannerMode | null
    cleanupDeadline: string | null
    isExpired: boolean
    showCountdown: boolean
    graceDays: number
    emphasizeWelcome?: boolean
    isExpiredSubscriber?: boolean
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
    bannerMode = 'test',
    cleanupDeadline,
    isExpired,
    showCountdown,
    graceDays,
    emphasizeWelcome = false,
    isExpiredSubscriber = false,
}: TestAccountBannerProps) {
    const deadlineMs = cleanupDeadline ? new Date(cleanupDeadline).getTime() : null
    const [remainingMs, setRemainingMs] = useState(() => deadlineMs ? Math.max(0, deadlineMs - Date.now()) : 0)
    const [isMobile, setIsMobile] = useState(false)
    const [expanded, setExpanded] = useState(false)

    const isPaidGraceBanner = bannerMode === 'paid_grace'
    const isPaidExpiredBanner = bannerMode === 'paid_expired'
    const isPaidBanner = isPaidGraceBanner || isPaidExpiredBanner
    const shouldRenderCountdown = showCountdown || isPaidGraceBanner

    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < 768)
        check()
        window.addEventListener('resize', check)
        return () => window.removeEventListener('resize', check)
    }, [])

    useEffect(() => {
        if (!deadlineMs || !shouldRenderCountdown) return
        const updateCountdown = () => setRemainingMs(Math.max(0, deadlineMs - Date.now()))
        updateCountdown()
        const interval = window.setInterval(updateCountdown, 1000)
        return () => window.clearInterval(interval)
    }, [deadlineMs, shouldRenderCountdown])

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

    if (!cleanupDeadline || (!shouldRenderCountdown && !isExpired && !isExpiredSubscriber && !isPaidBanner)) {
        return null
    }

    const isAlert = isExpired || isExpiredSubscriber || isPaidBanner
    const borderColor = isAlert ? 'rgba(248, 113, 113, 0.35)' : 'rgba(251, 191, 36, 0.28)'
    const bg = isAlert
        ? 'linear-gradient(135deg, rgba(127, 29, 29, 0.35), rgba(69, 10, 10, 0.22))'
        : 'linear-gradient(135deg, rgba(120, 53, 15, 0.34), rgba(15, 23, 42, 0.72))'
    const accentColor = isAlert ? '#fca5a5' : '#fbbf24'
    const iconBg = isAlert ? 'rgba(239, 68, 68, 0.16)' : 'rgba(251, 191, 36, 0.16)'
    const badgeBg = isAlert ? 'rgba(153, 27, 27, 0.28)' : 'rgba(120, 53, 15, 0.4)'

    const badgeLabel = isPaidGraceBanner
        ? 'Compte gele'
        : isPaidExpiredBanner
            ? 'Paiement requis'
            : isExpiredSubscriber
                ? 'Abonnement expire'
                : isExpired
                    ? 'Action requise'
                    : 'Compte test'

    const title = isPaidGraceBanner
        ? `Compte gele - regularisez avant le ${formattedDeadline}`
        : isPaidExpiredBanner
            ? 'Compte gele - paiement requis pour reactiver'
            : isExpiredSubscriber
                ? `Abonnement expire - compte supprime le ${formattedDeadline}`
                : isExpired
                    ? 'Compte expire - suppression imminente'
                    : emphasizeWelcome
                        ? `Bienvenue - votre compte expire le ${formattedDeadline}`
                        : `Compte en periode d'essai - suppression le ${formattedDeadline}`

    const description = isPaidGraceBanner
        ? `Votre periode payante a expire. Tous vos agents sont desactives et vos credits restants sont geles jusqu'au ${formattedDeadline}. Si vous regularisez avant cette date, vos agents pourront etre reactives et vos credits geles seront recuperes.`
        : isPaidExpiredBanner
            ? `Votre compte payant a expire apres sa periode de grace de ${graceDays} jours. Les creations d'agents, reactivations et connexions WhatsApp sont bloquees tant qu'aucun nouveau paiement n'est effectue.`
            : isExpiredSubscriber
                ? `Tous vos agents sont desactives et vos credits sont geles. Si vous renouvelez avant le ${formattedDeadline}, vos credits geles vous sont restitues et vos agents sont reactives immediatement.`
                : isExpired
                    ? 'Votre delai d essai est ecoule. Ce compte sera supprime tres prochainement. Souscrivez immediatement pour recuperer vos donnees.'
                    : `Sans paiement valide, ce compte et toutes vos donnees seront definitivement supprimes le ${formattedDeadline}. Cette action est irreversible.`

    const actionLine = isPaidBanner
        ? 'Effectuez un paiement pour debloquer votre compte, reactiver vos agents et restaurer vos droits.'
        : isExpiredSubscriber
            ? 'Renouvelez votre abonnement pour recuperer vos credits et reactiver vos agents.'
            : 'Pour conserver votre compte et vos donnees, souscrivez a un abonnement ou achetez des credits.'

    const ctaLabel = isPaidBanner || isExpiredSubscriber ? 'Regler maintenant' : 'Choisir un abonnement'
    const ctaBg = isPaidBanner || isExpiredSubscriber
        ? 'linear-gradient(135deg, #ef4444, #dc2626)'
        : 'linear-gradient(135deg, #25D366, #128C7E)'
    const ctaShadow = isPaidBanner || isExpiredSubscriber
        ? '0 4px 14px rgba(239, 68, 68, 0.35)'
        : '0 4px 14px rgba(37, 211, 102, 0.35)'

    const countdownInline = `${String(countdown.days).padStart(2, '0')}j ${String(countdown.hours).padStart(2, '0')}h ${String(countdown.minutes).padStart(2, '0')}m ${String(countdown.seconds).padStart(2, '0')}s`

    if (isMobile) {
        return (
            <div style={{ marginBottom: 16, borderRadius: 14, border: `1px solid ${borderColor}`, background: bg, overflow: 'hidden' }}>
                <div
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                    onClick={() => setExpanded((current) => !current)}
                >
                    <div style={{ width: 32, height: 32, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isAlert
                            ? <ShieldAlert style={{ width: 16, height: 16, color: accentColor }} />
                            : <Clock4 style={{ width: 16, height: 16, color: accentColor }} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>{badgeLabel}</span>
                            {shouldRenderCountdown && (
                                <span style={{ color: accentColor, fontSize: 12, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                                    {countdownInline}
                                </span>
                            )}
                        </div>
                    </div>
                    <Link
                        href="/dashboard/billing"
                        onClick={(event) => event.stopPropagation()}
                        style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: ctaBg, color: 'white', fontWeight: 700, fontSize: 12, textDecoration: 'none', flexShrink: 0, boxShadow: ctaShadow }}
                    >
                        {isPaidBanner || isExpiredSubscriber ? 'Regler' : 'Payer'}
                        <ArrowRight style={{ width: 12, height: 12 }} />
                    </Link>
                    {expanded
                        ? <ChevronUp style={{ width: 16, height: 16, color: '#64748b', flexShrink: 0 }} />
                        : <ChevronDown style={{ width: 16, height: 16, color: '#64748b', flexShrink: 0 }} />}
                </div>

                {expanded && (
                    <div style={{ padding: '0 14px 14px 14px', borderTop: `1px solid ${borderColor}` }}>
                        <p style={{ margin: '12px 0 10px', color: '#e2e8f0', lineHeight: 1.6, fontSize: 13 }}>
                            {description}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <AlertTriangle style={{ width: 14, height: 14, color: accentColor, flexShrink: 0, marginTop: 2 }} />
                            <span style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5 }}>{actionLine}</span>
                        </div>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div
            style={{
                marginBottom: 20,
                padding: 20,
                borderRadius: 18,
                border: `1px solid ${borderColor}`,
                background: bg,
                boxShadow: isAlert ? '0 10px 30px rgba(127, 29, 29, 0.18)' : '0 10px 30px rgba(120, 53, 15, 0.16)',
            }}
        >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isAlert
                        ? <ShieldAlert style={{ width: 22, height: 22, color: accentColor }} />
                        : <Clock4 style={{ width: 22, height: 22, color: accentColor }} />}
                </div>

                <div style={{ flex: 1, minWidth: 250 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                        <h3 style={{ margin: 0, color: 'white', fontSize: 18, fontWeight: 700 }}>{title}</h3>
                        <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: accentColor, background: badgeBg }}>
                            {badgeLabel}
                        </span>
                    </div>

                    <p style={{ margin: '0 0 12px 0', color: '#e2e8f0', lineHeight: 1.6, fontSize: 14 }}>{description}</p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                        <AlertTriangle style={{ width: 16, height: 16, color: accentColor }} />
                        <span style={{ color: '#cbd5e1', fontSize: 13 }}>{actionLine}</span>
                    </div>

                    <Link
                        href="/dashboard/billing"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 10, background: ctaBg, color: 'white', fontWeight: 700, fontSize: 14, textDecoration: 'none', marginBottom: 16, boxShadow: ctaShadow }}
                    >
                        {ctaLabel}
                        <ArrowRight style={{ width: 16, height: 16 }} />
                    </Link>

                    {shouldRenderCountdown && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 10, maxWidth: 460 }}>
                            {[
                                { label: 'Jours', value: countdown.days },
                                { label: 'Heures', value: countdown.hours },
                                { label: 'Minutes', value: countdown.minutes },
                                { label: 'Secondes', value: countdown.seconds },
                            ].map((item) => (
                                <div key={item.label} style={{ padding: '12px 10px', borderRadius: 14, background: 'rgba(15, 23, 42, 0.55)', border: '1px solid rgba(148, 163, 184, 0.12)', textAlign: 'center' }}>
                                    <div style={{ color: 'white', fontSize: 24, fontWeight: 800, lineHeight: 1 }}>
                                        {String(item.value).padStart(2, '0')}
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 6 }}>{item.label}</div>
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

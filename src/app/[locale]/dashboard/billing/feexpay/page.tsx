'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, RefreshCw } from 'lucide-react'

const FEEXPAY_CHECKOUT_SESSION_KEY = 'wazzapai_feexpay_checkout_context'

type CheckoutPhase = 'loading' | 'redirect_ready' | 'redirecting' | 'pending' | 'failed'

type FeexPayCheckoutContext = {
    transactionId: string
    paymentUrl: string
    fallbackPending?: boolean
    countryCode?: string
    networkCode?: string
    networkLabel?: string | null
    payerPhone?: string | null
    createdAt?: number
}

function isFallbackPendingUrl(url: string) {
    return url.includes('/dashboard/billing') && url.includes('payment=pending')
}

export default function FeexPayCheckoutPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const transactionId = String(searchParams.get('transaction_id') || '').trim()

    const [phase, setPhase] = useState<CheckoutPhase>('loading')
    const [context, setContext] = useState<FeexPayCheckoutContext | null>(null)
    const [attemptCount, setAttemptCount] = useState(0)
    const [statusMessage, setStatusMessage] = useState<string>('Verification du paiement en cours...')
    const [isChecking, setIsChecking] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const billingPath = useMemo(() => {
        const marker = '/dashboard/billing'
        const raw = String(pathname || '').trim()
        const markerIndex = raw.indexOf(marker)
        if (markerIndex >= 0) {
            return raw.slice(0, markerIndex + marker.length)
        }
        return '/dashboard/billing'
    }, [pathname])

    useEffect(() => {
        if (!transactionId) {
            setPhase('failed')
            setErrorMessage('Transaction FeexPay introuvable.')
            return
        }

        try {
            const raw = sessionStorage.getItem(FEEXPAY_CHECKOUT_SESSION_KEY)
            if (!raw) {
                setPhase('pending')
                setStatusMessage('Paiement initialise. Verification automatique en cours...')
                return
            }

            const parsed = JSON.parse(raw) as FeexPayCheckoutContext
            if (!parsed || String(parsed.transactionId || '').trim() !== transactionId) {
                setPhase('pending')
                setStatusMessage('Paiement initialise. Verification automatique en cours...')
                return
            }

            setContext(parsed)

            const paymentUrl = String(parsed.paymentUrl || '').trim()
            const fallbackPending = Boolean(parsed.fallbackPending) || isFallbackPendingUrl(paymentUrl)
            if (paymentUrl && !fallbackPending) {
                setPhase('redirect_ready')
                return
            }

            setPhase('pending')
            setStatusMessage('Demande envoyee. Confirmez sur votre telephone puis revenez sur cette page.')
        } catch (error) {
            console.error('Failed to read FeexPay checkout context:', error)
            setPhase('pending')
            setStatusMessage('Paiement initialise. Verification automatique en cours...')
        }
    }, [transactionId])

    const checkStatus = async () => {
        if (!transactionId || isChecking) return
        setIsChecking(true)
        try {
            const response = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: transactionId, transactionId }),
            })
            const data = await response.json()
            const providerStatus = String(data?.provider_status || '').trim().toUpperCase()
            const currentStatus = String(data?.current_status || '').trim().toLowerCase()

            if (response.ok && (currentStatus === 'completed' || providerStatus === 'ACCEPTED')) {
                setStatusMessage('Paiement confirme. Redirection vers la facturation...')
                try {
                    sessionStorage.removeItem(FEEXPAY_CHECKOUT_SESSION_KEY)
                } catch {}
                setTimeout(() => {
                    router.replace(`${billingPath}?payment=success&transaction_id=${encodeURIComponent(transactionId)}`)
                }, 600)
                return
            }

            if (providerStatus === 'REFUSED' || providerStatus === 'CANCELLED' || currentStatus === 'failed') {
                setPhase('failed')
                setErrorMessage('Paiement refuse ou annule. Aucun credit n a ete ajoute.')
                return
            }

            setStatusMessage('Paiement en attente de confirmation. Nous continuons la verification...')
        } catch (error) {
            console.error('Failed to verify FeexPay payment status:', error)
            setStatusMessage('Verification temporairement indisponible. Reessayez dans quelques secondes.')
        } finally {
            setIsChecking(false)
        }
    }

    useEffect(() => {
        if (phase !== 'redirect_ready' || !context?.paymentUrl) return

        const redirectTimer = setTimeout(() => {
            setPhase('redirecting')
            window.location.href = context.paymentUrl
        }, 1200)

        return () => clearTimeout(redirectTimer)
    }, [phase, context?.paymentUrl])

    useEffect(() => {
        if (phase !== 'pending') return

        let cancelled = false
        let attempts = 0

        const tick = async () => {
            if (cancelled) return
            attempts += 1
            setAttemptCount(attempts)
            await checkStatus()
        }

        void tick()
        const interval = setInterval(() => {
            if (attempts >= 36) {
                clearInterval(interval)
                setStatusMessage('Le paiement peut prendre plus de temps. Vous pouvez verifier manuellement ci-dessous.')
                return
            }
            void tick()
        }, 5000)

        return () => {
            cancelled = true
            clearInterval(interval)
        }
    }, [phase, transactionId])

    const renderBody = () => {
        if (phase === 'loading') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#cbd5e1' }}>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    Preparation du paiement FeexPay...
                </div>
            )
        }

        if (phase === 'redirect_ready' || phase === 'redirecting') {
            return (
                <>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                        Nous avons initialise votre paiement. Vous allez etre redirige vers la page FeexPay pour confirmer.
                    </p>
                    <div style={{ marginTop: 14, color: '#94a3b8', fontSize: 13 }}>
                        Reseau: <strong style={{ color: '#e2e8f0' }}>{context?.networkLabel || context?.networkCode || 'FeexPay'}</strong>
                    </div>
                    <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => {
                                if (context?.paymentUrl) {
                                    setPhase('redirecting')
                                    window.location.href = context.paymentUrl
                                }
                            }}
                            style={{
                                height: 40,
                                borderRadius: 10,
                                border: 'none',
                                padding: '0 14px',
                                color: 'white',
                                background: 'linear-gradient(135deg, #10b981, #059669)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                            }}
                        >
                            <ExternalLink style={{ width: 16, height: 16 }} />
                            Continuer vers le paiement
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace(billingPath)}
                            style={{
                                height: 40,
                                borderRadius: 10,
                                border: '1px solid rgba(148, 163, 184, 0.35)',
                                padding: '0 14px',
                                color: '#cbd5e1',
                                background: 'rgba(15, 23, 42, 0.35)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <ArrowLeft style={{ width: 16, height: 16 }} />
                            Retour facturation
                        </button>
                    </div>
                </>
            )
        }

        if (phase === 'pending') {
            return (
                <>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                        {statusMessage}
                    </p>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>
                        Tentatives de verification: {attemptCount}
                    </div>
                    <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => void checkStatus()}
                            disabled={isChecking}
                            style={{
                                height: 40,
                                borderRadius: 10,
                                border: 'none',
                                padding: '0 14px',
                                color: 'white',
                                background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                cursor: isChecking ? 'default' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                fontWeight: 600,
                            }}
                        >
                            {isChecking ? (
                                <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                            ) : (
                                <RefreshCw style={{ width: 16, height: 16 }} />
                            )}
                            Verifier maintenant
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace(billingPath)}
                            style={{
                                height: 40,
                                borderRadius: 10,
                                border: '1px solid rgba(148, 163, 184, 0.35)',
                                padding: '0 14px',
                                color: '#cbd5e1',
                                background: 'rgba(15, 23, 42, 0.35)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                            }}
                        >
                            <ArrowLeft style={{ width: 16, height: 16 }} />
                            Retour facturation
                        </button>
                    </div>
                </>
            )
        }

        return (
            <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#fca5a5', marginBottom: 8 }}>
                    <AlertCircle style={{ width: 18, height: 18 }} />
                    <strong>Paiement non confirme</strong>
                </div>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    {errorMessage || 'Le paiement n a pas pu etre confirme automatiquement.'}
                </p>
                <div style={{ marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={() => router.replace(billingPath)}
                        style={{
                            height: 40,
                            borderRadius: 10,
                            border: '1px solid rgba(148, 163, 184, 0.35)',
                            padding: '0 14px',
                            color: '#cbd5e1',
                            background: 'rgba(15, 23, 42, 0.35)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <ArrowLeft style={{ width: 16, height: 16 }} />
                        Retour facturation
                    </button>
                </div>
            </>
        )
    }

    return (
        <div style={{ minHeight: '72vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 16 }}>
            <div
                style={{
                    width: '100%',
                    maxWidth: 680,
                    background: 'rgba(15, 23, 42, 0.72)',
                    border: '1px solid rgba(148, 163, 184, 0.24)',
                    borderRadius: 16,
                    padding: 24,
                    backdropFilter: 'blur(16px)',
                }}
            >
                <div style={{ marginBottom: 8, color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>
                    Paiement FeexPay
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18 }}>
                    Transaction: <strong style={{ color: '#e2e8f0' }}>{transactionId || '-'}</strong>
                </div>
                {renderBody()}
            </div>
        </div>
    )
}

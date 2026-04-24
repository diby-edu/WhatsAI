'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertCircle, ArrowLeft, ExternalLink, Loader2, RefreshCw } from 'lucide-react'
import ManualPaymentFallbackCard from '@/components/payments/manual-payment-fallback-card'

type CheckoutPhase = 'loading' | 'redirect_ready' | 'redirecting' | 'pending' | 'failed'
type CheckStatusOutcome = 'success' | 'failed' | 'pending' | 'pause'

const STORAGE_KEY_PREFIX = 'wazzapai_paydunya_checkout'

function readContext(transactionId: string): { paymentUrl: string; transactionId: string } | null {
    const key = `${STORAGE_KEY_PREFIX}:${transactionId}`
    for (const storage of [sessionStorage, localStorage]) {
        try {
            const raw = storage.getItem(key)
            if (!raw) continue
            const parsed = JSON.parse(raw)
            if (String(parsed?.transactionId || '').trim() === transactionId) return parsed
        } catch {}
    }
    return null
}

function clearContext(transactionId: string) {
    const key = `${STORAGE_KEY_PREFIX}:${transactionId}`
    for (const storage of [sessionStorage, localStorage]) {
        try { storage.removeItem(key) } catch {}
    }
}

export default function PayDunyaCheckoutPage() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const transactionId = String(searchParams.get('transaction_id') || '').trim()
    const isReturning = searchParams.get('returning') === '1'
    const isFailed = searchParams.get('failed') === '1'

    const [phase, setPhase] = useState<CheckoutPhase>('loading')
    const [paymentUrl, setPaymentUrl] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState('Vérification du paiement en cours...')
    const [isChecking, setIsChecking] = useState(false)
    const [attemptCount, setAttemptCount] = useState(0)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const billingPath = useMemo(() => {
        const marker = '/dashboard/billing'
        const raw = String(pathname || '').trim()
        const idx = raw.indexOf(marker)
        return idx >= 0 ? raw.slice(0, idx + marker.length) : '/dashboard/billing'
    }, [pathname])

    useEffect(() => {
        if (!transactionId) {
            setPhase('failed')
            setErrorMessage('Transaction PayDunya introuvable.')
            return
        }

        if (isFailed) {
            setPhase('failed')
            setErrorMessage('Le paiement a été annulé ou a échoué sur PayDunya.')
            return
        }

        if (isReturning) {
            // User is returning from PayDunya checkout — verify payment
            clearContext(transactionId)
            setPhase('pending')
            setStatusMessage('Retour de PayDunya détecté. Vérification du paiement...')
            return
        }

        // First visit — read context and redirect to PayDunya
        const ctx = readContext(transactionId)
        if (ctx?.paymentUrl) {
            setPaymentUrl(ctx.paymentUrl)
            setPhase('redirect_ready')
        } else {
            // No context (direct URL access) — just verify
            setPhase('pending')
            setStatusMessage('Vérification du paiement en cours...')
        }
    }, [transactionId, isReturning, isFailed])

    const checkStatus = async (): Promise<CheckStatusOutcome> => {
        if (!transactionId || isChecking) return 'pending'
        setIsChecking(true)
        try {
            const res = await fetch('/api/payments/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ paymentId: transactionId, transactionId }),
            })
            const data = await res.json()
            const providerStatus = String(data?.provider_status || '').trim().toUpperCase()
            const currentStatus = String(data?.current_status || '').trim().toLowerCase()
            const providerError = String(data?.provider_response?.message || data?.error || '').trim()

            if (res.ok && (currentStatus === 'completed' || providerStatus === 'ACCEPTED')) {
                setStatusMessage('Paiement confirmé. Redirection vers la facturation...')
                clearContext(transactionId)
                setTimeout(() => {
                    router.replace(`${billingPath}?payment=success&transaction_id=${encodeURIComponent(transactionId)}`)
                }, 600)
                return 'success'
            }

            if (providerStatus === 'REFUSED' || providerStatus === 'CANCELLED' || currentStatus === 'failed') {
                setPhase('failed')
                setErrorMessage(providerError || 'Paiement refusé ou annulé.')
                return 'failed'
            }

            if (!res.ok) {
                setStatusMessage(providerError || 'Vérification en pause. Cliquez sur "Vérifier maintenant".')
                return 'pause'
            }

            setStatusMessage('Paiement en attente de confirmation PayDunya...')
            return 'pending'
        } catch {
            setStatusMessage('Vérification temporairement indisponible. Réessayez dans quelques secondes.')
            return 'pause'
        } finally {
            setIsChecking(false)
        }
    }

    // Auto-redirect to PayDunya
    useEffect(() => {
        if (phase !== 'redirect_ready' || !paymentUrl) return
        const t = setTimeout(() => {
            setPhase('redirecting')
            window.location.href = paymentUrl
        }, 1200)
        return () => clearTimeout(t)
    }, [phase, paymentUrl])

    // Polling after returning from PayDunya
    useEffect(() => {
        if (phase !== 'pending') return
        let cancelled = false
        let attempts = 0
        let stopped = false
        let interval: ReturnType<typeof setInterval> | null = null

        const tick = async () => {
            if (cancelled || stopped) return
            attempts += 1
            setAttemptCount(attempts)
            const outcome = await checkStatus()
            if (outcome === 'success' || outcome === 'failed' || outcome === 'pause') {
                stopped = true
                if (interval) clearInterval(interval)
            }
            if (attempts >= 12 && !stopped) {
                stopped = true
                if (interval) clearInterval(interval)
                setStatusMessage('Le paiement prend plus de temps. Cliquez sur "Vérifier maintenant" après confirmation.')
            }
        }

        void tick()
        interval = setInterval(() => { void tick() }, 5000)
        return () => { cancelled = true; if (interval) clearInterval(interval) }
    }, [phase, transactionId])

    const renderBody = () => {
        if (phase === 'loading') {
            return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#cbd5e1' }}>
                    <Loader2 style={{ width: 18, height: 18, animation: 'spin 1s linear infinite' }} />
                    Préparation du paiement PayDunya...
                </div>
            )
        }

        if (phase === 'redirect_ready' || phase === 'redirecting') {
            return (
                <>
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                        Vous allez être redirigé vers la page de paiement sécurisée PayDunya.
                    </p>
                    <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => { if (paymentUrl) { setPhase('redirecting'); window.location.href = paymentUrl } }}
                            style={{
                                height: 40, borderRadius: 10, border: 'none', padding: '0 14px',
                                color: 'white', background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600,
                            }}
                        >
                            <ExternalLink style={{ width: 16, height: 16 }} />
                            Continuer vers le paiement
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace(billingPath)}
                            style={{
                                height: 40, borderRadius: 10, border: '1px solid rgba(148,163,184,0.35)',
                                padding: '0 14px', color: '#cbd5e1', background: 'rgba(15,23,42,0.35)',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
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
                    <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{statusMessage}</p>
                    <div style={{ marginTop: 10, color: '#94a3b8', fontSize: 12 }}>
                        Tentatives de vérification : {attemptCount}
                    </div>
                    <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            onClick={() => void checkStatus()}
                            disabled={isChecking}
                            style={{
                                height: 40, borderRadius: 10, border: 'none', padding: '0 14px',
                                color: 'white', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                                cursor: isChecking ? 'default' : 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600,
                            }}
                        >
                            {isChecking
                                ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                                : <RefreshCw style={{ width: 16, height: 16 }} />}
                            Vérifier maintenant
                        </button>
                        <button
                            type="button"
                            onClick={() => router.replace(billingPath)}
                            style={{
                                height: 40, borderRadius: 10, border: '1px solid rgba(148,163,184,0.35)',
                                padding: '0 14px', color: '#cbd5e1', background: 'rgba(15,23,42,0.35)',
                                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
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
                    <strong>Paiement non confirmé</strong>
                </div>
                <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>
                    {errorMessage || 'Le paiement n\'a pas pu être confirmé automatiquement.'}
                </p>
                <div style={{ marginTop: 18 }}>
                    <button
                        type="button"
                        onClick={() => router.replace(billingPath)}
                        style={{
                            height: 40, borderRadius: 10, border: '1px solid rgba(148,163,184,0.35)',
                            padding: '0 14px', color: '#cbd5e1', background: 'rgba(15,23,42,0.35)',
                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
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
            <div style={{
                width: '100%', maxWidth: 680,
                background: 'rgba(15, 23, 42, 0.72)',
                border: '1px solid rgba(148, 163, 184, 0.24)',
                borderRadius: 16, padding: 24,
                backdropFilter: 'blur(16px)',
            }}>
                <div style={{ marginBottom: 8, color: '#e2e8f0', fontSize: 20, fontWeight: 700 }}>
                    Paiement PayDunya
                </div>
                <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 18 }}>
                    Transaction : <strong style={{ color: '#e2e8f0' }}>{transactionId || '-'}</strong>
                </div>
                {renderBody()}
                {(phase === 'pending' || phase === 'failed') && (
                    <div style={{ marginTop: 18 }}>
                        <ManualPaymentFallbackCard compact />
                    </div>
                )}
            </div>
        </div>
    )
}

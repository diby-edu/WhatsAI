'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { CheckCircle2, XCircle, Loader2, MessageCircle, ArrowRight, CreditCard, RefreshCw } from 'lucide-react'

function PaymentSuccessContent() {
    const searchParams = useSearchParams()
    const transactionId = searchParams.get('transaction_id')

    const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'pending'>('loading')
    const [message, setMessage] = useState('')
    const [creditsAdded, setCreditsAdded] = useState(0)
    const [retryCount, setRetryCount] = useState(0)

    useEffect(() => {
        let isMounted = true
        let currentRetry = 0

        const verifyPayment = async (txnId: string) => {
            if (!isMounted) return

            try {
                const res = await fetch('/api/payments/cinetpay/status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ transaction_id: txnId })
                })

                const data = await res.json()

                if (!isMounted) return

                if (data.success && data.status === 'ACCEPTED') {
                    setStatus('success')
                    setCreditsAdded(data.credits_added || 0)
                    setMessage('Votre paiement a été confirmé et vos crédits ont été ajoutés !')
                } else if (data.status === 'REFUSED' || data.status === 'CANCELLED') {
                    setStatus('failed')
                    setMessage('Le paiement a été refusé ou annulé.')
                } else {
                    // Still pending, retry in 3 seconds (max 10 retries)
                    if (currentRetry < 10) {
                        setStatus('pending')
                        setMessage('Vérification du paiement en cours...')
                        currentRetry++
                        setTimeout(() => verifyPayment(txnId), 3000)
                    } else {
                        setStatus('pending')
                        setMessage('Le paiement est en cours de traitement. Vous recevrez vos crédits sous peu.')
                    }
                }
            } catch (err) {
                if (isMounted) {
                    console.error('Error verifying payment:', err)
                    setStatus('failed')
                    setMessage('Erreur lors de la vérification du paiement.')
                }
            }
        }

        if (transactionId) {
            verifyPayment(transactionId)
        } else {
            // No transaction ID, check for simple success/cancelled
            const paymentParam = searchParams.get('payment')
            if (paymentParam === 'success') {
                setStatus('success')
                setMessage('Votre paiement a été traité avec succès.')
            } else if (paymentParam === 'cancelled') {
                setStatus('failed')
                setMessage('Le paiement a été annulé.')
            } else {
                setStatus('failed')
                setMessage('Aucune transaction trouvée.')
            }
        }

        return () => {
            isMounted = false
        }
    }, [transactionId, searchParams])



    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#020617',
            padding: 24
        }}>
            {/* Background effects */}
            <div style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: 'linear-gradient(rgba(148, 163, 184, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.03) 1px, transparent 1px)',
                backgroundSize: '60px 60px',
                opacity: 0.5
            }} />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                    textAlign: 'center',
                    maxWidth: 480,
                    width: '100%',
                    background: 'rgba(15, 23, 42, 0.8)',
                    backdropFilter: 'blur(40px)',
                    border: '1px solid rgba(148, 163, 184, 0.1)',
                    borderRadius: 28,
                    padding: 48,
                    position: 'relative',
                    zIndex: 10
                }}
            >
                {/* Status Icon */}
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: 'spring' }}
                    style={{
                        width: 100,
                        height: 100,
                        margin: '0 auto 24px',
                        borderRadius: '50%',
                        background: status === 'success'
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.2))'
                            : status === 'failed'
                                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(220, 38, 38, 0.2))'
                                : 'linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(245, 158, 11, 0.2))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}
                >
                    {status === 'loading' && (
                        <Loader2 style={{ width: 50, height: 50, color: '#fbbf24', animation: 'spin 1s linear infinite' }} />
                    )}
                    {status === 'pending' && (
                        <RefreshCw style={{ width: 50, height: 50, color: '#fbbf24', animation: 'spin 2s linear infinite' }} />
                    )}
                    {status === 'success' && (
                        <CheckCircle2 style={{ width: 50, height: 50, color: '#34d399' }} />
                    )}
                    {status === 'failed' && (
                        <XCircle style={{ width: 50, height: 50, color: '#f87171' }} />
                    )}
                </motion.div>

                {/* Title */}
                <h1 style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: 12
                }}>
                    {status === 'loading' && 'Vérification...'}
                    {status === 'pending' && 'Traitement en cours...'}
                    {status === 'success' && 'Paiement réussi ! 🎉'}
                    {status === 'failed' && 'Paiement échoué'}
                </h1>

                {/* Message */}
                <p style={{
                    fontSize: 16,
                    color: '#94a3b8',
                    marginBottom: 24,
                    lineHeight: 1.6
                }}>
                    {message}
                </p>

                {/* Credits added */}
                {status === 'success' && creditsAdded > 0 && (
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '12px 24px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        borderRadius: 12,
                        marginBottom: 32
                    }}>
                        <CreditCard style={{ width: 20, height: 20, color: '#34d399' }} />
                        <span style={{ fontSize: 16, fontWeight: 600, color: '#34d399' }}>
                            +{creditsAdded} crédits ajoutés
                        </span>
                    </div>
                )}

                {/* Action buttons */}
                {(status === 'success' || status === 'failed' || (status === 'pending' && retryCount >= 10)) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
                        <Link
                            href="/dashboard"
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 10,
                                padding: '16px 32px',
                                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                borderRadius: 14,
                                color: 'white',
                                fontWeight: 600,
                                textDecoration: 'none',
                                boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)'
                            }}
                        >
                            Retour au tableau de bord
                            <ArrowRight style={{ width: 18, height: 18 }} />
                        </Link>

                        {status === 'failed' && (
                            <Link
                                href="/dashboard/billing"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 8,
                                    padding: '14px 24px',
                                    background: 'rgba(30, 41, 59, 0.5)',
                                    border: '1px solid rgba(148, 163, 184, 0.1)',
                                    borderRadius: 14,
                                    color: '#94a3b8',
                                    fontWeight: 500,
                                    textDecoration: 'none'
                                }}
                            >
                                Réessayer le paiement
                            </Link>
                        )}
                    </div>
                )}
            </motion.div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    )
}

export default function PaymentSuccessPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#020617'
            }}>
                <Loader2 style={{ width: 32, height: 32, color: '#34d399', animation: 'spin 1s linear infinite' }} />
            </div>
        }>
            <PaymentSuccessContent />
        </Suspense>
    )
}
